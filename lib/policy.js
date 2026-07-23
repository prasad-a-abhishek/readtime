'use strict';

// Policy linter: enforces a reading-time / word-count budget on a
// document and explains (when requested) what the engine measured and
// which budgets were checked. Exits can be wired through a CLI without
// affecting the library API: this module is opt-in.

const rt = require('..');

// Default block handling. Users override via a policy file or flags.
//   - 'include' = count words inside that block type
//   - 'exclude' = skip entirely
//   - 'fixed-seconds' = a constant-seconds allowance regardless of words
const DEFAULT_BLOCK_POLICY = Object.freeze({
  code:    'exclude',  // existing behavior: fenced code is removed by md parser
  images:  'include',  // count image captions and alt text as words
  tables:  'include',  // count cell content
  links:   'include',  // count link text
});

// Validate a parsed policy object. Returns { ok: bool, errors: [] }.
// Pure function — does not mutate input.
function validatePolicy(p) {
  const errors = [];
  if (p == null || typeof p !== 'object') {
    return { ok: false, errors: ['policy must be an object'] };
  }
  const num = (k, min, max) => {
    if (p[k] == null) return;
    if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) {
      errors.push(`${k} must be a finite number`);
      return;
    }
    if (min != null && p[k] < min) errors.push(`${k} must be >= ${min}`);
    if (max != null && p[k] > max) errors.push(`${k} must be <= ${max}`);
  };
  num('minMinutes', 0, 24 * 60);
  num('maxMinutes', 0, 24 * 60);
  num('minWords', 0, 10_000_000);
  num('maxWords', 0, 10_000_000);
  if (p.minMinutes != null && p.maxMinutes != null && p.minMinutes > p.maxMinutes) {
    errors.push('minMinutes must be <= maxMinutes');
  }
  if (p.minWords != null && p.maxWords != null && p.minWords > p.maxWords) {
    errors.push('minWords must be <= maxWords');
  }
  if (p.wpm != null) {
    if (typeof p.wpm !== 'number' || !Number.isFinite(p.wpm) || p.wpm < 1 || p.wpm > 10000) {
      errors.push('wpm must be a number between 1 and 10000');
    }
  }
  if (p.mode != null && !['plain', 'markdown', 'html'].includes(p.mode)) {
    errors.push(`mode must be plain|markdown|html (got ${JSON.stringify(p.mode)})`);
  }
  if (p.failOn != null && !['over', 'under', 'any'].includes(p.failOn)) {
    errors.push(`failOn must be over|under|any (got ${JSON.stringify(p.failOn)})`);
  }
  if (p.blocks != null) {
    if (typeof p.blocks !== 'object') {
      errors.push('blocks must be an object');
    } else {
      for (const [k, v] of Object.entries(p.blocks)) {
        if (!['include', 'exclude', 'fixed-seconds'].includes(v)) {
          errors.push(`blocks.${k} must be include|exclude|fixed-seconds (got ${JSON.stringify(v)})`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// Merge CLI flags with an optional policy file. CLI flags win on
// every field that is explicitly set. This is a small data merge; we
// never mutate input objects.
function merge(flags, filePolicy) {
  const merged = { ...(filePolicy || {}), ...(flags || {}) };
  // Block policy: shallow merge so CLI can override any single key.
  if (filePolicy && filePolicy.blocks) {
    merged.blocks = { ...DEFAULT_BLOCK_POLICY, ...filePolicy.blocks };
  }
  return merged;
}

// Lint a document against a merged policy. Returns:
//   {
//     ok:          boolean  — true if inside every configured budget
//     inBudget:    true if no budget was violated
//     violations:  [{ kind, limit, actual, message }]
//     measured:    { words, minutes, seconds }
//     explain:     string   — multi-line diagnostic when explain=true
//     policy:      the effective policy used
//   }
//
// A "violation" is when a budget is set and exceeded in the direction
// specified by `failOn`:
//   - 'over'  (default): fail on maxMinutes/maxWords violations only
//   - 'under':           fail on minMinutes/minWords violations only
//   - 'any':             fail on either side
//
// The measured values are always reported even when no budget is set.
function lint(text, opts) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }
  const flags = opts || {};
  const filePolicy = flags.__filePolicy || {};
  delete flags.__filePolicy;
  const policy = merge(flags, filePolicy);

  const validated = validatePolicy(policy);
  if (!validated.ok) {
    throw new Error('invalid policy: ' + validated.errors.join('; '));
  }

  const mode = policy.mode || 'markdown';
  const wpm = policy.wpm || 200;

  // stats() returns words/chars/sentences/paragraphs. The 'minutes'
  // field is computed from words / wpm (rounded up, min 1 minute).
  const s = rt.stats(text, { wordsPerMinute: wpm }, mode);
  const measured = {
    words: s.words,
    minutes: s.readingTimeMinutes,
    seconds: s.readingTimeSeconds,
    characters: s.chars,
    sentences: s.sentences,
    paragraphs: s.paragraphs,
  };

  const failOn = policy.failOn || 'over';
  const violations = [];
  // Each budget has a direction. `limit` is a target; actual can be
  // above or below it. We pick the side that counts as a violation
  // based on the budget's semantic role (min vs max).
  const checkBudget = (kind, limit, actual, isMax) => {
    if (limit == null) return;
    // For max budgets: violation is actual > limit.
    // For min budgets: violation is actual < limit.
    const violated = isMax ? actual > limit : actual < limit;
    if (!violated) return;
    if (failOn === 'over' && !isMax) return;   // 'over' ignores min-side underruns
    if (failOn === 'under' && isMax) return;   // 'under' ignores max-side overages
    violations.push({ kind, limit, actual });
  };
  checkBudget('maxMinutes', policy.maxMinutes, measured.minutes, true);
  checkBudget('maxWords',   policy.maxWords,   measured.words,   true);
  checkBudget('minMinutes', policy.minMinutes, measured.minutes, false);
  checkBudget('minWords',   policy.minWords,   measured.words,   false);

  let explain = null;
  if (policy.explain) {
    const lines = [];
    lines.push(`readtime policy lint`);
    lines.push(`  mode:                  ${mode}`);
    lines.push(`  wpm:                   ${wpm}`);
    lines.push(`  failOn:                ${failOn}`);
    lines.push(`  measured.words:        ${measured.words}`);
    lines.push(`  measured.characters:   ${measured.characters}`);
    lines.push(`  measured.sentences:    ${measured.sentences}`);
    lines.push(`  measured.paragraphs:   ${measured.paragraphs}`);
    lines.push(`  measured.minutes:      ${measured.minutes}`);
    lines.push(`  measured.seconds:      ${measured.seconds}`);
    if (policy.minMinutes != null) lines.push(`  budget.minMinutes:     ${policy.minMinutes}  ${measured.minutes >= policy.minMinutes ? 'OK' : 'UNDER'}`);
    if (policy.maxMinutes != null) lines.push(`  budget.maxMinutes:     ${policy.maxMinutes}  ${measured.minutes <= policy.maxMinutes ? 'OK' : 'OVER'}`);
    if (policy.minWords != null)   lines.push(`  budget.minWords:       ${policy.minWords}  ${measured.words >= policy.minWords ? 'OK' : 'UNDER'}`);
    if (policy.maxWords != null)   lines.push(`  budget.maxWords:       ${policy.maxWords}  ${measured.words <= policy.maxWords ? 'OK' : 'OVER'}`);
    if (policy.blocks) {
      lines.push(`  blocks:`);
      for (const [k, v] of Object.entries(policy.blocks)) lines.push(`    - ${k}: ${v}`);
    }
    if (violations.length) {
      lines.push(`  violations:`);
      for (const v of violations) lines.push(`    - ${v.kind}: actual=${v.actual} limit=${v.limit}`);
    } else {
      lines.push(`  violations: (none)`);
    }
    explain = lines.join('\n');
  }

  return {
    ok: violations.length === 0,
    inBudget: violations.length === 0,
    violations,
    measured,
    explain,
    policy,
  };
}

module.exports = {
  lint,
  validatePolicy,
  merge,
  DEFAULT_BLOCK_POLICY,
};
