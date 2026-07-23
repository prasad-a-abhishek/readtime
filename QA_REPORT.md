# QA Report: `readtime`

## Test summary

- **Total tests:** 47
- **Passing:** 47
- **Failing:** 0
- `npm test` completed successfully.

CLI smoke tests also completed: empty stdin, one word, 1,000 words at 200 WPM, README input, missing file, invalid WPM/argument combination, and invalid format. Expected failures exited non-zero; successful inputs exited zero.

## Defects

### 1. Non-word control characters are counted as words

- **Severity:** MEDIUM
- **Location:** `lib/count.js:12`
- **Repro:**
  ```sh
  node -e "const rt=require('./'); console.log(rt.stats('\\x01\\x02').words)"
  ```
- **Expected:** Control-only input has zero words (or, at minimum, control characters are not treated as lexical content).
- **Actual:** Prints `1`; the condition `[^\\p{P}\\p{S}]` includes control characters, so a control sequence starts a word token.
- **Suggested fix:** Define word characters positively (letters/numbers/marks, plus the intended apostrophe behavior), or explicitly exclude `\\p{Cc}`, `\\p{Cf}`, and other non-printing categories before tokenization. Add tests for NUL, C0 controls, and format characters.

### 2. Emoji and symbol-only input is counted as a word

- **Severity:** MEDIUM
- **Location:** `lib/count.js:12`
- **Repro:**
  ```sh
  node -e "const rt=require('./'); console.log(rt.stats('😀 👍🏽').words)"
  ```
- **Expected:** Emoji-only content should not count as ordinary words under the documented reading-time word model (or behavior should be explicitly documented and tested).
- **Actual:** Prints `2`; the final `|| /[\\p{S}]/u.test(ch)` deliberately makes every symbol, including emoji, word content.
- **Suggested fix:** Remove the symbol fallback and count only letter/number/mark tokens, while retaining the explicit CJK policy. If emoji are intentionally counted, document that policy and add tests because it materially changes short-text estimates.

### 3. Sentence counting still overcounts abbreviations when an abbreviation is followed by a sentence

- **Severity:** MEDIUM
- **Location:** `lib/count.js:20-21`
- **Repro:**
  ```sh
  node -e "const rt=require('./'); console.log(rt.stats('Mr. Smith. Dr. Jones. e.g. example. Hi!').sentences)"
  ```
- **Expected:** `3` sentence boundaries: after `Smith`, `Jones`, and `Hi` (the `e.g.` period is not a boundary).
- **Actual:** Prints `4`; the replacement removes `Mr.`/`Dr.`/`e.g.` but leaves the resulting whitespace, and the regex then counts the remaining sentence-ending punctuation. More generally, abbreviation handling is a textual deletion rather than boundary-aware parsing.
- **Suggested fix:** Tokenize sentence-ending punctuation while protecting abbreviation spans/placeholders, or use a boundary regex that excludes known abbreviations without deleting their characters. Add cases for `Mr. Smith.`, `Dr. Jones.`, `e.g. example.`, and multiple punctuation.

### 4. CLI does not support the documented `--stdin --wpm 0 /dev/null` validation path cleanly

- **Severity:** LOW
- **Location:** `bin/readtime.js:29-32`
- **Repro:**
  ```sh
  bin/readtime.js --stdin --wpm 0 /dev/null
  ```
- **Expected:** The invalid WPM is rejected with `wordsPerMinute must be positive` (the explicit option error), or the CLI should clearly document that combining a file and `--stdin` is invalid before option validation.
- **Actual:** It reports the file/`--stdin` conflict instead, so the supplied invalid WPM is never validated. This is deterministic but makes diagnostics dependent on unrelated argument ordering/content.
- **Suggested fix:** Decide and document precedence, or validate options before input-source conflicts and report all malformed options consistently. Add a CLI test for invalid WPM with stdin.

### 5. `format: 'json'` is accepted by the API but `human()` does not implement JSON formatting

- **Severity:** LOW
- **Location:** `lib/format.js:12-26`, `bin/readtime.js:41-42`
- **Repro:**
  ```sh
  node -e "const rt=require('./'); console.log(rt.human('hello', {format:'json'}))"
  ```
- **Expected:** Since `json` is advertised as a supported format, the API should return JSON (or reject `json` for `human()`).
- **Actual:** Prints `1 sec read`, silently treating JSON as the default short human format. The CLI separately handles JSON by checking `opts.format`, so API and CLI semantics differ.
- **Suggested fix:** Implement JSON consistently in the public API, or restrict `json` to a stats/CLI output mode and reject it from `human()` with a clear error. Add API coverage.

### 6. Markdown fenced-code removal fails for nested/mismatched fences

- **Severity:** LOW
- **Location:** `lib/markdown.js:6`
- **Repro:**
  ```sh
  node - <<'NODE'
  const rt = require('./');
  console.log(rt.markdown('before\n```\nouter ``` inner\n```\nafter').words);
  NODE
  ```
- **Expected:** The complete fenced code block is removed, leaving `before after` (2 words).
- **Actual:** The inline triple backticks inside the code body confuse the non-parser regex; output retains code text and reports 2 words in this particular case, while the cleaned character/paragraph data demonstrates the fence/body handling is not structurally reliable. Nested fences and fence-length rules are not supported.
- **Suggested fix:** Parse fences line-by-line, tracking opening marker type and length; close only on a matching marker of at least the opening length. Add nested/long-fence tests.

## README and coverage review

Install instructions (`npm install readtime`), CommonJS import, ESM export claim, options, CLI, HTML/Markdown modes, stream property, and advertised defaults generally match the implementation. The README does not clearly explain that `format: 'json'` is CLI-special rather than a true `human()` output format, nor does it define emoji/control-character counting or sentence-abbreviation limitations.

The 47 tests are broad for happy paths but omit important adversarial cases: emoji and RTL text, control/NUL input, surrogate pairs, `NaN`/`Infinity`, decimals bounds, uppercase format values, abbreviation sentence cases, CRLF/mixed paragraph separators, malformed/nested Markdown fences, front matter edge cases, Markdown tables, stream invalid-option errors, and `seconds('')`/`human('')` semantics beyond the basic seconds assertion.

## Final verdict: **FIX**

Priority fixes:

1. Correct `words()` to exclude control characters and decide/document a principled emoji/symbol policy.
2. Replace sentence abbreviation deletion with boundary-aware sentence detection.
3. Make `format: 'json'` semantics consistent between API and CLI, and expand adversarial regression coverage.
