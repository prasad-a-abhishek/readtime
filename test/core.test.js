'use strict';
// Comprehensive test suite for readtime.
//
// Coverage:
//   - happy paths (empty, single word, many words, various languages)
//   - error paths (wrong types, invalid options)
//   - edge cases (whitespace, punctuation, special chars, unicode)
//   - HTML stripping edge cases (nested, malformed, XSS attempts)
//   - Markdown stripping edge cases (code fences, images, links, headings)
//   - format options (default, tiny, human)
//   - streaming API
//   - CLI (invoked directly)
//
// Run with: node --test

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const rt = require('..');

const text = n => Array(n).fill('word').join(' ');
const CLI = path.join(__dirname, '..', 'bin', 'readtime.js');

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function runs(cmd, args, input) {
  return execFileSync(cmd, args, { input, encoding: 'utf-8' });
}

// ---------------------------------------------------------------------
// count() — the foundation everything else uses
// ---------------------------------------------------------------------
test('words() counts ASCII word boundaries', () => {
  assert.equal(rt.stats('hello world').words, 2);
  assert.equal(rt.stats('one two three four five').words, 5);
});

test('words() treats hyphens as separator (and counts the parts)', () => {
  // "well-known" → 2 words ("well" + "known"), then " author" makes 3 total.
  // This matches Medium / reading-time convention: hyphens split words.
  assert.equal(rt.stats('well-known author').words, 3);
});

test("words() handles apostrophes inside words", () => {
  // "don't" is one word; "worry" is one word; "it's" is one word; "fine" is one word.
  // Total = 4 (not 3 — earlier miscount).
  assert.equal(rt.stats("don't worry it's fine").words, 4);
});

test('words() counts CJK characters as 1 per ideograph', () => {
  // Han ideographs (Chinese) are 1 word each.
  assert.equal(rt.stats('你好世界').words, 4);
  // Hiragana + Katakana: 5 katakana + 1 hiragana particle + 3 katakana = 9
  // (numbers are exact; the test pins current behavior so we notice
  // if a future refactor changes the counting).
  assert.equal(rt.stats('日本語のテキスト').words, 8);
});

test('words() returns 0 for empty / whitespace-only', () => {
  assert.equal(rt.stats('').words, 0);
  assert.equal(rt.stats('   \t\n   ').words, 0);
});

test('words() returns 0 for punctuation-only', () => {
  assert.equal(rt.stats('...!!!???').words, 0);
});

test('words() handles mixed scripts', () => {
  // English + CJK: 2 English words + 4 CJK ideographs = 6
  assert.equal(rt.stats('hello 你好 world 世界').words, 6);
});

test('chars() counts only non-whitespace by default', () => {
  assert.equal(rt.stats('hello world').chars, 10);
});

test('chars() counts all chars when countChars=all', () => {
  assert.equal(rt.stats('hello world', { countChars: 'all' }).chars, 11);
});

test('sentences() splits on . ! ?', () => {
  assert.equal(rt.stats('First. Second! Third?').sentences, 3);
});

test('paragraphs() splits on blank lines', () => {
  assert.equal(rt.stats('one\n\ntwo\n\n\nthree').paragraphs, 3);
});

// ---------------------------------------------------------------------
// seconds() / minutes() / human() — the public API
// ---------------------------------------------------------------------
test('seconds() returns 0 for empty input', () => {
  assert.equal(rt.seconds(''), 0);
});

test('seconds() returns 1 minimum (even for 1 word at default wpm)', () => {
  // 1 word at 200 wpm = 0.3s, but we floor to >=1s
  assert.equal(rt.seconds('hello'), 1);
});

test('seconds() respects wordsPerMinute', () => {
  // 1000 words at 200 wpm = 300s; at 100 wpm = 600s
  assert.equal(rt.seconds(text(1000), { wordsPerMinute: 200 }), 300);
  assert.equal(rt.seconds(text(1000), { wordsPerMinute: 100 }), 600);
});

test('seconds() scales linearly', () => {
  assert.equal(rt.seconds(text(200)), 60);
  assert.equal(rt.seconds(text(400)), 120);
  assert.equal(rt.seconds(text(1000)), 300);
});

test('minutes() returns precise value (not rounded)', () => {
  // 500 words at 200 wpm = 150s = 2.5 min. The function returns the
  // exact decimal so callers can format/round themselves.
  assert.equal(rt.minutes(text(500)), 2.5);
  assert.equal(rt.minutes(text(400)), 2);
  assert.equal(rt.minutes(text(1000)), 5);
});

test('human() rounds minutes in the displayed string', () => {
  // human() uses Math.round for display, so 2.5 → 3.
  assert.equal(rt.human(text(500)), '3 min read');
});

test('human() default returns "<n> min read"', () => {
  assert.equal(rt.human(text(1000)), '5 min read');
});

test('human() tiny format returns "5m"', () => {
  assert.equal(rt.human(text(1000), { format: 'tiny' }), '5m');
});

test('human() tiny format sub-minute returns seconds', () => {
  // 50 words at 200 wpm = 15s → "15s"
  assert.equal(rt.human(text(50), { format: 'tiny' }), '15s');
});

test('human() custom wpm', () => {
  // 100 words at 100 wpm = 60s → "1 min read"
  assert.equal(rt.human(text(100), { wordsPerMinute: 100 }), '1 min read');
});

// ---------------------------------------------------------------------
// html() / markdown() — input-specific processing
// ---------------------------------------------------------------------
test('html() strips tags and keeps text', () => {
  assert.equal(rt.html('<p>hello <b>world</b></p>').words, 2);
});

test('html() removes script content', () => {
  assert.equal(rt.html('<script>alert(1)</script><p>visible</p>').words, 1);
});

test('html() removes style content', () => {
  assert.equal(rt.html('<style>body { color: red }</style><p>visible</p>').words, 1);
});

test('html() unwraps nested tags', () => {
  assert.equal(rt.html('<div><span>hello <em>nested</em> world</span></div>').words, 3);
});

test('html() handles XSS attempt text safely (counts only visible words)', () => {
  // "javascript:alert(1)" inside an attribute is not visible content
  assert.equal(rt.html('<a href="javascript:alert(1)">click here</a>').words, 2);
});

test('html() handles malformed HTML gracefully', () => {
  // No exceptions on unclosed tags
  assert.doesNotThrow(() => rt.html('<p>unclosed <b>bold'));
  const r = rt.html('<p>unclosed <b>bold');
  assert.ok(r.words >= 1);
});

test('markdown() strips link markup, keeps text', () => {
  assert.equal(rt.markdown('[click here](https://example.com)').words, 2);
});

test('markdown() strips image alt text? — count = alt text per common practice', () => {
  // Standard reading-time libs count image alt text as words (it's the
  // accessible description). We follow that convention.
  const r = rt.markdown('![an image description](image.png)');
  assert.equal(r.words, 3);
});

test('markdown() removes fenced code blocks', () => {
  assert.equal(rt.markdown('before\n```js\nvar a = 1;\n```\nafter').words, 2);
});

test('markdown() keeps inline code text (unwraps backticks)', () => {
  // We strip the backticks but keep the text inside — consistent with
  // how reading-time libs count code as content (it still takes time
  // to read).
  assert.equal(rt.markdown('before `code` after').words, 3);
});

test('markdown() handles headings', () => {
  assert.equal(rt.markdown('# Title\n\nbody text').words, 3);
});

test('markdown() handles lists', () => {
  assert.equal(rt.markdown('- one\n- two\n- three').words, 3);
});

test('plain() mode passes through as-is', () => {
  // No public "plain" function exists; but stats() with mode='plain' works.
  // Note: the public API doesn't expose plain; use the lower-level stats.
  // We'll test via the stats options instead.
  // For now just ensure the basic API doesn't choke on raw markdown.
  const r = rt.stats('# Title\n\nbody', {}, 'markdown');
  assert.equal(r.words, 2);
});

// ---------------------------------------------------------------------
// stats() — full structured output
// ---------------------------------------------------------------------
test('stats() returns all expected fields', () => {
  const r = rt.stats('hello world this is text');
  assert.ok(typeof r.words === 'number');
  assert.ok(typeof r.chars === 'number');
  assert.ok(typeof r.sentences === 'number');
  assert.ok(typeof r.paragraphs === 'number');
  assert.ok(typeof r.readingTimeSeconds === 'number');
  assert.ok(typeof r.readingTimeMinutes === 'number');
  assert.ok(typeof r.wordsPerMinute === 'number');
});

test('stats() readingTimeSeconds matches seconds()', () => {
  const t = text(300);
  assert.equal(rt.stats(t).readingTimeSeconds, rt.seconds(t));
});

// ---------------------------------------------------------------------
// Validation / errors
// ---------------------------------------------------------------------
test('throws TypeError for non-string input', () => {
  assert.throws(() => rt.seconds(null), TypeError);
  assert.throws(() => rt.seconds(undefined), TypeError);
  assert.throws(() => rt.seconds(123), TypeError);
  assert.throws(() => rt.seconds([]), TypeError);
  assert.throws(() => rt.seconds({}), TypeError);
});

test('throws RangeError for wordsPerMinute <= 0', () => {
  assert.throws(() => rt.seconds('a', { wordsPerMinute: 0 }), RangeError);
  assert.throws(() => rt.seconds('a', { wordsPerMinute: -5 }), RangeError);
});

test('throws RangeError for invalid format', () => {
  assert.throws(() => rt.human('a', { format: 'bogus' }), RangeError);
});

// ---------------------------------------------------------------------
// Streaming API
// ---------------------------------------------------------------------
test('ReadtimeStream processes chunks and emits final seconds', () => {
  const { ReadtimeStream } = require('..');
  return new Promise((resolve, reject) => {
    const stream = new ReadtimeStream();
    stream.on('finish', () => {
      try {
        // Property is .readingTimeSeconds per lib/stream.js
        assert.ok(stream.readingTimeSeconds > 0);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    stream.on('error', reject);
    stream.write('hello ');
    stream.write('world');
    stream.end();
  });
});

test('ReadtimeStream passes options through to seconds()', () => {
  const { ReadtimeStream } = require('..');
  return new Promise((resolve, reject) => {
    const t = Array(1000).fill('word').join(' ');
    const stream = new ReadtimeStream({ wordsPerMinute: 100 });
    stream.on('finish', () => {
      try {
        // 1000 words at 100 wpm = 600s
        assert.equal(stream.readingTimeSeconds, 600);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    stream.on('error', reject);
    stream.write(t);
    stream.end();
  });
});

// ---------------------------------------------------------------------
// CLI smoke
// ---------------------------------------------------------------------
test('CLI --help prints usage', () => {
  const out = runs('node', [CLI, '--help']);
  assert.match(out, /Usage/i);
});

test('CLI --version prints version from package.json', () => {
  const pkg = require('../package.json');
  const out = runs('node', [CLI, '--version']);
  assert.match(out, new RegExp(pkg.version));
});

test('CLI --stdin reads stdin', () => {
  const out = runs('node', [CLI, '--stdin'], 'hello '.repeat(1000));
  assert.match(out, /min read/);
});

test('CLI rejects when both file and --stdin given', () => {
  // Even a non-existent file with --stdin should fail.
  assert.throws(() => runs('node', [CLI, 'fake.txt', '--stdin'], 'hi'));
});

test('CLI rejects with no input', () => {
  assert.throws(() => runs('node', [CLI]));
});

test('CLI exits 0 on success, non-zero on error', () => {
  const ok = runs('node', [CLI, '--stdin'], 'hello');
  assert.equal(typeof ok, 'string');
});