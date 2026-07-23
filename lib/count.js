'use strict';

const assertText = text => { if (typeof text !== 'string') throw new TypeError('text must be a string'); };
const CJK = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u;
// Unicode categories that count as word content. Letter (L) + Number (N)
// + Mark (M) covers all real words across scripts. CJK is also a Letter
// category in Unicode but we keep the explicit CJK branch for the "each
// ideograph = 1 word" policy. We exclude:
//   - Cc (control chars like NUL, \x01, etc.) — they're not readable text.
//   - Cf (format chars like ZWSP) — already stripped before tokenization.
//   - Co (private use) — not real text.
//   - Cn (unassigned) — not real text.
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
// Common abbreviations whose trailing period should NOT be a sentence
// boundary. We split into two groups:
//   - "single-word" abbrevs: a single token that ends with one period
//     (Mr., Dr., vs., etc.)
//   - "multi-period" abbrevs: contain internal periods (e.g., i.e.)
// For multi-period, we treat the entire dotted sequence as a single
// "abbreviation span" and only count a sentence boundary AFTER the final
// period (and only if not followed by whitespace + uppercase word, etc.).
const ABBREV_TOKEN = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st',
  'vs', 'etc', 'approx', 'dept', 'est',
  'am', 'pm', 'no', 'vol',
]);
// Patterns where the period is part of a multi-period abbreviation.
// Matched as a single token; the FINAL period is not a sentence boundary
// unless it's followed by an uppercase letter (indicating a real sentence
// start), not just a lowercase continuation.
const MULTI_PERIOD = /\b(?:e\.g|i\.e|cf|al|seq|fig|no|pp|viz)\./i;

function words(text) {
  assertText(text);
  // Strip zero-width and bidi control characters first.
  const stripped = text.replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu, '');
  let count = 0, token = false;
  for (const ch of stripped) {
    if (CJK.test(ch)) {
      // CJK: each ideograph is its own word.
      if (token) { count++; token = false; }
      count++;
    } else if (/[-\s]/u.test(ch) || ch === '\0') {
      // Word separator: emit the current token if any.
      if (token) { count++; token = false; }
    } else if (WORD_CHAR.test(ch) || ch === "'") {
      // Word content: letter, number, mark, or apostrophe.
      token = true;
    } else {
      // Everything else (punctuation, symbols, emoji, control chars):
      // ends the current token. Emoji/symbols are NOT counted as words.
      if (token) { count++; token = false; }
    }
  }
  return count + (token ? 1 : 0);
}

function chars(text, all = false) {
  assertText(text);
  return all ? [...text].length : [...text.replace(/\s/gu, '')].length;
}

function sentences(text) {
  assertText(text);
  // Strategy: walk the text, find every period/exclaim/question run
  // (e.g. "..." or "?!") followed by whitespace or end-of-string, and
  // decide whether each one is a real sentence boundary.
  //
  // A boundary is REAL unless:
  //   1. The preceding word (letters/digits, no whitespace) is a known
  //      single-word abbreviation (Mr., Dr., vs., etc.).
  //   2. The punctuation is the FINAL period of a multi-period
  //      abbreviation (e.g., i.e., e.g., cf., etc.) AND the next
  //      non-whitespace character is lowercase (suggesting continuation).
  //   3. The punctuation is immediately followed by a lowercase letter
  //      (e.g., "Hello w..." in mid-sentence from a typo) — we count it
  //      as a boundary anyway because that's the standard convention.
  let count = 0;
  const re = /[.!?]+(?=\s|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    // Check for multi-period abbreviation: e.g., i.e., etc.
    if (MULTI_PERIOD.test(text.slice(Math.max(0, m.index - 6), m.index + m[0].length))) {
      // Is the next non-whitespace char a lowercase letter? If so,
      // skip — it's a continuation ("e.g. some examples").
      const after = text.slice(m.index + m[0].length);
      const nextChar = (after.match(/^\s*(\S)/) || [])[1];
      if (nextChar && /[a-z]/.test(nextChar)) continue;
    }
    // Look back through whitespace to find the preceding word.
    let i = m.index - 1;
    while (i >= 0 && /\s/.test(text[i])) i--;
    const wordEnd = i + 1;
    while (i >= 0 && /[\p{L}\p{N}]/u.test(text[i])) i--;
    const word = text.slice(i + 1, wordEnd).toLowerCase();
    if (ABBREV_TOKEN.has(word)) continue;
    count++;
  }
  return count;
}

function paragraphs(text) {
  assertText(text);
  if (!text.trim()) return 0;
  return text.trim().split(/(?:\r?\n|\r)\s*(?:\r?\n|\r)+/).filter(Boolean).length;
}

module.exports = { assertText, words, chars, sentences, paragraphs, ABBREV_TOKEN };
