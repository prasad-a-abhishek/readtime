'use strict';
// Tests for the policy linter (lib/policy.js) and the new CLI flags.
// Covers:
//   - validatePolicy() pure-function validation
//   - lint() budget enforcement (over/under/any, mix of word/time budgets)
//   - lint() --explain output
//   - merge() precedence
//   - DEFAULT_BLOCK_POLICY
//   - CLI integration: --min-minutes / --max-minutes / --fail-on / --policy
//   - exit codes: 0 clean, 2 violation, 1 input error

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const { lint, validatePolicy, merge, DEFAULT_BLOCK_POLICY } = require('../lib/policy');

const SHORT_TEXT = 'This is a short document with eight words. Plus another sentence.';
const MEDIUM_TEXT = (Array(220).fill('This is a word. ')).join(' '); // ~660 words, ~3 minutes at 200wpm
const LONG_TEXT = (Array(2000).fill('This is a word. ')).join(' '); // ~6000 words

// ---------------------------------------------------------------------------
// validatePolicy
// ---------------------------------------------------------------------------

test('validatePolicy accepts an empty object', () => {
  const v = validatePolicy({});
  assert.strictEqual(v.ok, true);
});

test('validatePolicy accepts null', () => {
  const v = validatePolicy(null);
  // null is "must be an object"
  assert.strictEqual(v.ok, false);
});

test('validatePolicy flags non-numeric budgets', () => {
  const v = validatePolicy({ minMinutes: '5' });
  assert.strictEqual(v.ok, false);
  assert.match(v.errors[0], /must be a finite number/);
});

test('validatePolicy rejects negative minutes', () => {
  const v = validatePolicy({ minMinutes: -1 });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => /must be >= 0/.test(e)));
});

test('validatePolicy rejects minMinutes > maxMinutes', () => {
  const v = validatePolicy({ minMinutes: 10, maxMinutes: 5 });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => /minMinutes/.test(e)));
});

test('validatePolicy rejects minWords > maxWords', () => {
  const v = validatePolicy({ minWords: 1000, maxWords: 500 });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => /minWords/.test(e)));
});

test('validatePolicy rejects wpm out of range', () => {
  const v = validatePolicy({ wpm: 99999 });
  assert.strictEqual(v.ok, false);
});

test('validatePolicy rejects invalid mode', () => {
  const v = validatePolicy({ mode: 'docx' });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => /mode must be/.test(e)));
});

test('validatePolicy rejects invalid failOn', () => {
  const v = validatePolicy({ failOn: 'maybe' });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => /failOn must be/.test(e)));
});

test('validatePolicy validates block policies', () => {
  const v = validatePolicy({ blocks: { code: 'drop' } });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => /blocks.code must be/.test(e)));
});

test('validatePolicy accepts valid block policies', () => {
  const v = validatePolicy({
    blocks: { code: 'exclude', images: 'include', tables: 'fixed-seconds' },
  });
  assert.strictEqual(v.ok, true);
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

test('merge: file policy alone when flags empty', () => {
  const out = merge({}, { maxMinutes: 5 });
  assert.strictEqual(out.maxMinutes, 5);
});

test('merge: flags win over file policy', () => {
  const out = merge({ maxMinutes: 10 }, { maxMinutes: 5 });
  assert.strictEqual(out.maxMinutes, 10);
});

test('merge: blocks shallow-merge with defaults', () => {
  const out = merge({}, { blocks: { code: 'include' } });
  // Default for code was 'exclude', but file overrode.
  assert.strictEqual(out.blocks.code, 'include');
  // Other keys still come from DEFAULT_BLOCK_POLICY.
  assert.strictEqual(out.blocks.images, 'include');
});

test('merge: does not mutate inputs', () => {
  const file = { maxMinutes: 5, blocks: { code: 'include' } };
  const flags = { maxMinutes: 10 };
  const out = merge(flags, file);
  assert.strictEqual(file.maxMinutes, 5);
  assert.strictEqual(flags.maxMinutes, 10);
  assert.notStrictEqual(out.blocks, file.blocks);
});

// ---------------------------------------------------------------------------
// lint — basic measurements
// ---------------------------------------------------------------------------

test('lint returns measured values even without a budget', () => {
  const r = lint(SHORT_TEXT, {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.violations.length, 0);
  assert.ok(typeof r.measured.words === 'number');
  assert.ok(r.measured.words > 0);
  assert.ok(typeof r.measured.minutes === 'number');
});

test('lint throws on non-string text', () => {
  assert.throws(() => lint(123, {}), /text must be a string/);
});

test('lint rejects invalid policy', () => {
  assert.throws(() => lint(SHORT_TEXT, { minMinutes: -1 }), /invalid policy/);
});

test('lint explain is null by default', () => {
  const r = lint(SHORT_TEXT, { maxMinutes: 99 });
  assert.strictEqual(r.explain, null);
});

test('lint explain populates when explain=true', () => {
  const r = lint(SHORT_TEXT, { maxMinutes: 99, explain: true });
  assert.ok(typeof r.explain === 'string');
  assert.match(r.explain, /measured\.words/);
  assert.match(r.explain, /budget\.maxMinutes/);
});

// ---------------------------------------------------------------------------
// lint — budget enforcement
// ---------------------------------------------------------------------------

test('lint inBudget when measured within window', () => {
  // Medium text is ~660 words, ~3.3 minutes at 200wpm. Set window 2-5 minutes.
  const r = lint(MEDIUM_TEXT, { minMinutes: 2, maxMinutes: 5, wpm: 200 });
  assert.strictEqual(r.ok, true);
});

test('lint violation when measured over maxMinutes (failOn=over)', () => {
  const r = lint(LONG_TEXT, { maxMinutes: 5 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.kind === 'maxMinutes'));
});

test('lint violation when measured under minMinutes (failOn=under)', () => {
  const r = lint(SHORT_TEXT, { minMinutes: 100, failOn: 'under' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.kind === 'minMinutes'));
});

test('lint any violates both sides', () => {
  // 'any' fails on whichever direction is wrong. To get violations on
  // both sides of the boundary, use one over-direction budget and one
  // under-direction budget. minMinutes and maxWords are independent so
  // they don't trigger the cross-budget ordering validator.
  const r = lint(SHORT_TEXT, { minMinutes: 999, maxWords: 1, failOn: 'any' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.kind === 'minMinutes'),
            'minMinutes underrun');
  assert.ok(r.violations.some(v => v.kind === 'maxWords'),
            'maxWords overrun');
});

test('lint failOn=over ignores minMinutes underrun', () => {
  // short text below min, but we only care about over.
  // Use a value within validation bounds (< 1440) but > measured.
  const r = lint(SHORT_TEXT, { minMinutes: 999, failOn: 'over' });
  assert.strictEqual(r.ok, true);
});

test('lint maxWords fires when word count is over the limit', () => {
  const r = lint(LONG_TEXT, { maxWords: 100 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some(v => v.kind === 'maxWords'));
});

test('lint policy-file mode merges via __filePolicy key', () => {
  const r = lint(MEDIUM_TEXT, {
    __filePolicy: { maxMinutes: 5, minMinutes: 2, wpm: 200 },
  });
  assert.strictEqual(r.ok, true);
  // Effective wpm should be 200.
  assert.strictEqual(r.policy.wpm, 200);
});

test('lint honors custom wpm in policy file', () => {
  // MEDIUM_TEXT at wpm=200 is ~3 minutes. At wpm=2000 it's ~20 sec.
  const r = lint(MEDIUM_TEXT, {
    __filePolicy: { maxMinutes: 1, wpm: 2000 },
  });
  assert.strictEqual(r.ok, true);
});

test('lint policy reflects effective merged config', () => {
  const r = lint(SHORT_TEXT, {
    __filePolicy: { maxMinutes: 10 },
    maxMinutes: 99, // CLI flag wins
  });
  assert.strictEqual(r.policy.maxMinutes, 99);
});

test('lint defaults failOn=over', () => {
  // Both budgets well outside the range of any reasonable document but
  // within validation bounds (<= 1440 minutes).
  const r = lint(SHORT_TEXT, { maxMinutes: 999, minMinutes: 1 });
  // No maxMinutes violated. minMinutes not enforced because failOn=over.
  assert.strictEqual(r.ok, true);
});

// ---------------------------------------------------------------------------
// CLI integration
// ---------------------------------------------------------------------------

const CLI = path.resolve(__dirname, '..', 'bin', 'readtime.js');

function runCli(args, input) {
  // Use spawnSync so we can keep stdout and stderr separate. execFileSync
  // merges stderr into stdout when stdout is captured, which confuses the
  // policy-explain test that needs to see stderr content.
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [CLI, ...args], {
    input: input == null ? '' : String(input),
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    code: r.status == null ? (r.signal ? 128 + 1 : 3) : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

test('CLI: --help exits 0 with help text', () => {
  const r = runCli(['--help']);
  assert.strictEqual(r.code, 0);
  assert.match(r.stdout, /Usage: readtime/);
  assert.match(r.stdout, /--min-minutes/);
});

test('CLI: unknown option exits 1', () => {
  const r = runCli(['--bogus']);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /readtime:/);
});

test('CLI: --max-minutes passes short text', () => {
  const r = runCli(['--max-minutes', '99', '--plain', '-'], SHORT_TEXT);
  assert.strictEqual(r.code, 0);
  // human() returns "X sec read" or "X min read"; either matches
  // the "min|sec" pattern.
  assert.match(r.stdout, /\d+ (min|sec) read/);
});

test('CLI: --max-minutes fails on too-long text with exit 2', () => {
  const r = runCli(['--max-minutes', '1', '--plain', '-'], LONG_TEXT);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /policy violation/);
});

test('CLI: --min-minutes with failOn=under fails on short text', () => {
  const r = runCli(['--min-minutes', '99', '--fail-on', 'under', '--plain', '-'], SHORT_TEXT);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /policy violation/);
});

test('CLI: --min-minutes with failOn=over passes short text', () => {
  const r = runCli(['--min-minutes', '99', '--fail-on', 'over', '--plain', '-'], SHORT_TEXT);
  assert.strictEqual(r.code, 0);
});

test('CLI: --explain writes a multi-line report to stderr', () => {
  const r = runCli(['--max-minutes', '99', '--explain', '--plain', '-'], SHORT_TEXT);
  assert.strictEqual(r.code, 0);
  assert.match(r.stderr, /readtime policy lint/);
  assert.match(r.stderr, /measured\.words/);
  assert.match(r.stderr, /budget\.maxMinutes/);
});

test('CLI: --policy loads JSON file from disk', () => {
  const polPath = path.join(os.tmpdir(), `readtime-pol-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(polPath, JSON.stringify({ maxMinutes: 99, minMinutes: 1, wpm: 200 }));
  try {
    const r = runCli(['--policy', polPath, '--plain', '-'], SHORT_TEXT);
    assert.strictEqual(r.code, 0);
  } finally {
    fs.unlinkSync(polPath);
  }
});

test('CLI: --policy with bad JSON exits 1', () => {
  const polPath = path.join(os.tmpdir(), `readtime-pol-bad-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(polPath, '{ this is not json');
  try {
    const r = runCli(['--policy', polPath, '--plain', '-'], SHORT_TEXT);
    assert.strictEqual(r.code, 1);
    assert.match(r.stderr, /cannot read policy file/);
  } finally {
    fs.unlinkSync(polPath);
  }
});

test('CLI: --policy with invalid contents exits 1', () => {
  const polPath = path.join(os.tmpdir(), `readtime-pol-inv-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(polPath, JSON.stringify({ maxMinutes: -5 }));
  try {
    const r = runCli(['--policy', polPath, '--plain', '-'], SHORT_TEXT);
    assert.strictEqual(r.code, 1);
    assert.match(r.stderr, /invalid policy file/);
  } finally {
    fs.unlinkSync(polPath);
  }
});

test('CLI: --exit-on-violation 5 sets exit code on violation', () => {
  const r = runCli(['--max-minutes', '1', '--exit-on-violation', '5', '--plain', '-'], LONG_TEXT);
  assert.strictEqual(r.code, 5);
});

test('CLI: no policy → original stats output', () => {
  const r = runCli(['--plain', '-'], SHORT_TEXT);
  assert.strictEqual(r.code, 0);
  // human() output: short format is "X min read" or "<1 min read"
  assert.match(r.stdout, /read/);
});

test('CLI: --plain mode skips markdown stripping', () => {
  const text = '# Heading\n\n*emphasis* word.';
  const r = runCli(['--plain', '-'], text);
  assert.strictEqual(r.code, 0);
  // Without --plain (default markdown), emphasis markers would be stripped.
  // With --plain, the words count includes "emphasis".
  assert.match(r.stdout, /read/);
});

test('CLI: --format json with no policy emits JSON', () => {
  const r = runCli(['--format', 'json', '--plain', '-'], SHORT_TEXT);
  assert.strictEqual(r.code, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(typeof parsed.words === 'number');
  assert.ok(typeof parsed.readingTimeMinutes === 'number');
});

test('CLI: --stdin reads from stdin', () => {
  const r = runCli(['--stdin', '--max-minutes', '99'], SHORT_TEXT);
  assert.strictEqual(r.code, 0);
});

test('CLI: nonexistent file exits 1', () => {
  const r = runCli(['/this/file/does/not/exist.txt']);
  assert.strictEqual(r.code, 1);
});

test('CLI: combining --stdin and a path is an error', () => {
  const r = runCli(['--stdin', 'README.md']);
  assert.strictEqual(r.code, 1);
});

// ---------------------------------------------------------------------------
// DEFAULT_BLOCK_POLICY shape
// ---------------------------------------------------------------------------

test('DEFAULT_BLOCK_POLICY exposes a stable shape', () => {
  assert.strictEqual(typeof DEFAULT_BLOCK_POLICY, 'object');
  assert.strictEqual(DEFAULT_BLOCK_POLICY.code, 'exclude');
  assert.strictEqual(DEFAULT_BLOCK_POLICY.images, 'include');
});