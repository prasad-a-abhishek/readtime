# Reading-time workflow audit

_Research audit, 23 July 2026. Repository inspected: README, `index.js`, `bin/readtime.js`, and `lib/` (no code changed)._

## Executive finding

Most products do not “measure” reading time. They extract or approximate readable text, count units, divide by a fixed rate (commonly 200 words/minute), then round into a reassuring UI label such as “5 min read.” The hard and valuable part is not the division; it is deciding **what the reader will actually encounter** and **which units/rates are defensible for that content**.

`readtime` should not compete as one more Medium clone. Its credible wedge is a **deterministic, auditable CI/CLI quality gate for publishable content**: produce reproducible stats from Markdown/HTML, expose exactly what was counted, and fail builds when a document violates a declared reading-time budget. It already has unusually good foundations (zero dependencies, parsers, JSON, detailed stats); it lacks the policy/gating layer and trustworthy multilingual model.

## Phase 1 — Tool audit: how the market computes/displays time

| Tool/workflow | Computation/display behavior | Implication |
|---|---|---|
| Medium | The canonical pattern is word count divided by an average rate, presented as whole-minute “min read.” Medium is widely copied more than independently validated. Its historical method also adds time for images, which demonstrates that non-prose blocks matter. | A WPM-only estimator can disagree with the platform users use as their reference, especially for image-heavy stories. |
| `reading-time` npm | Explicitly defaults to 200 WPM and returns minutes, milliseconds, and word count. It supports custom `wordsPerMinute`, `wordBound`, and a stream. Its README admits extraction from Markdown/HTML is approximate and warns that non-alphabetical/non-CJK languages may behave incorrectly. | The commodity API is already small, fast, customizable, and stream-capable. “Tiny estimator” alone is not a wedge. |
| “Medium-style” blog packages | Typically wrappers around `reading-time` or `ceil(words / 200)`, inserted into frontmatter/build templates and rendered as `N min read`. Their differentiation is framework integration, not estimation science. | Framework-specific adapters are useful distribution, not a product moat. |
| Postlight/Mercury Parser | Article extraction is the upstream problem: isolate title, author, lead image and article body from arbitrary pages before counting. It is a full content extractor, not a reading-time estimator. | `stripHtml()` is suitable for known article HTML, not arbitrary URLs/pages containing nav, related stories, cookie text, comments, etc. |
| Hemingway App / word-count tools | Writer tools calculate counts live in the editor; Hemingway emphasizes readability grade, difficult sentences, passive voice, adverbs, and reading/writing time. Generic counters often offer words, characters, sentences, paragraphs and speaking/reading time. | `readtime` matches the count panel but not the editorial feedback or live/browser workflow. Counts are table stakes. |
| Ghost | Reading time is a theme helper (`{{reading_time}}`), restricted to posts, with localized strings for `< 1`, `1`, and plural minutes. Calculation occurs against Ghost’s structured post representation. | Rendering/i18n and content model integration matter as much as arithmetic. Ghost explicitly supports translatable labels. |
| Substack | The useful workflow is preview/publish rendering: authors see the post as newsletter/web content, while the product controls which blocks exist. Reading-time presentation is platform-owned rather than a user-configurable CLI calculation. | A local estimator cannot promise parity unless it understands the renderer’s structured blocks and exclusions. |

## Phase 2 — What users complain about

Recurring “reading time is wrong” reports are generally specification failures, not arithmetic bugs:

1. **Rounding and minimums:** 30 seconds appears as “1 min,” or a platform’s 5 minutes differs from a counter’s 4.2. Platforms use different ceiling/rounding/minimum rules.
2. **Wrong body:** boilerplate, captions, footnotes, alt text, comments, navigation, related links, frontmatter, code, and hidden DOM are included or excluded differently.
3. **Media and code:** images, diagrams, embeds, tables and code require attention but have few “words.” Medium-style image bonuses and prose-only tools diverge sharply.
4. **Reader variation:** technical prose, second-language readers, accessibility tools and skimming make a universal 200 WPM fictionally precise.
5. **Multilingual counting:** whitespace tokenization breaks scripts without spaces; treating every Han/Hiragana/Katakana/Hangul character as a “word” also conflates languages and writing systems. Agglutinative languages make word counts incomparable even when tokenization succeeds.
6. **Editor versus rendered output:** Markdown syntax, MDX/components, templated shortcodes, email-only blocks and dynamically injected content produce preview/published discrepancies.

The honest product behavior is therefore a stable **estimate with declared policy**, not a claim of exact reading duration.

## Phase 3 — Tuesday workflows (five concrete personas)

### 1. Independent blogger

On Tuesday they finish `post.md` and want a badge before commit. Today:

```sh
readtime --markdown post.md
readtime --markdown --format json post.md
```

This works for ordinary Markdown. Failure modes: fenced code is removed entirely (even if readers inspect it), images contribute their label but no viewing allowance, MDX/shortcodes are not understood, and the default output may not match Medium/Ghost rounding.

### 2. News-site editor

They need to enforce “analysis should be 4–7 minutes” across CMS-rendered HTML and publish a localized label. Today:

```sh
readtime --html --wpm 220 --format json rendered.html
```

JSON is automation-friendly, but the command never exits nonzero for a time-budget violation. Whole-page HTML may count masthead/sidebar/footer because this is stripping, not article extraction. No selector/exclusion policy, image/table weighting, locale label, or reproducible config file exists.

### 3. Documentation writer

They pipe generated docs in CI and want tutorial-length guardrails:

```sh
npm run build-doc | readtime --stdin --markdown --format json
```

stdin and JSON are good. However, streams are buffered in memory (`ReadtimeStream` stores all chunks), code fences vanish even when code comprehension is central, CLI has no `--max-minutes`, `--min-minutes`, `--exclude`, config, or compact machine-only field selection. Default Markdown mode can also surprise users passing plain prose with angle-bracket-like content.

### 4. E-reader developer

They have chapters as HTML/EPUB content and need per-chapter seconds to drive progress UI. `html()` and exact integer seconds are useful. But EPUB spine traversal, DOM extraction, footnotes, image/figure dwell time, language metadata, per-user pace, and ESM/browser entry points are missing. CommonJS-only requires a wrapper; the “streaming” API does not incrementally count.

### 5. Multilingual content lead

They compare English, Japanese, Korean and Arabic editions. Unicode letters/marks are recognized and zero-width/bidi controls are stripped—better than ASCII-only counters. But all Han, Hiragana, Katakana **and every Hangul character** count as one word and then use the same 200 WPM. That is not linguistic tokenization or language-specific reading speed. Sentence counting only recognizes ASCII `.?!`, missing `。！？` and other terminators; labels are English-only. Cross-locale dashboards will look precise while being semantically inconsistent.

## Phase 4 — Current `readtime` coverage

### SHIPPED

- Plain/Markdown/HTML paths; Markdown removes frontmatter and fenced code, normalizes common syntax; HTML removes comments, tags, scripts/styles and decodes common/numeric entities.
- Words, Unicode code-point characters, sentences, paragraphs.
- Seconds, configurable WPM, rounded minutes/minimum, and `short`/`long`/`tiny`/`json` formats.
- CLI input by file, `-`, or `--stdin`; concrete flags: `--wpm`, `--format`, `--html`, `--markdown`, `--help`, `--version`.
- JSON stats and a pass-through Node transform.
- Zero runtime dependencies and a small auditable implementation.

### PARTIAL

- **Multilingual:** Unicode-aware token characters and special CJK handling, but character-as-word plus one global WPM is not locale-aware; sentence detection is English punctuation/abbreviation-centric.
- **HTML:** robust stripping for known content fragments, but not article extraction, DOM semantics, selectors, block policies, or URL fetching.
- **Markdown:** handles common Markdown, but regex transforms cannot model every nesting edge case, MDX, directives or renderer-specific components. It silently excludes all fenced code.
- **Streaming:** API shape exists, but buffers every chunk and computes only at flush—no bounded-memory/incremental advantage.
- **Formatting:** several English labels and JSON exist, but no localization/custom message templates or platform-compatible policies.
- **Stats:** broad counts, but no reading burden by block type or audit trace explaining inclusions/exclusions.

### MISSING

- ESM/browser build and TypeScript declarations.
- Language/locale detection or explicit `--locale`; script-specific units/rates and Unicode sentence boundaries.
- Images, code, tables, equations, audio/video/embed weighting.
- Article extraction/selector controls (`--selector article`, `--exclude .related`).
- Frontmatter output/update and framework/CMS plugins.
- CI policy flags and exit codes: e.g. `--min-minutes 4 --max-minutes 7`, `--max-words`, `--fail-on`.
- Config/policy file to make local and CI calculations identical.
- Explain mode and corpus parity tests against selected renderers/platform policies.

## Phase 5 — ONE wedge

### **Reading-time budgets as code**

Position `readtime` as the zero-dependency, deterministic checker that teams run on every content change—not as a supposedly more accurate stopwatch.

A proposed concrete workflow:

```sh
readtime article.md --markdown --policy .readtimerc --format json \
  --min-minutes 4 --max-minutes 7 --explain
# exit 0 inside budget; stable documented nonzero exit outside it
```

The policy pins WPM, rounding/minimum, content mode, code/image treatment, locale, and exclusions. `--explain` reports source units and excluded/weighted blocks. This wedge uses the package’s real advantages—CLI, JSON, parsers, detailed stats, no dependency tree—and solves a recurring Tuesday problem that `reading-time`’s function API, Medium badges, Hemingway, Ghost and Substack do not solve consistently: **reviewable editorial constraints in Git/CI**.

Do not split attention across URL extraction, a full readability editor, and personal-speed prediction. Integrate with renderers later through adapters that feed canonical content into the same policy engine.

## Phase 6 — Recommendation

**Proceed, but narrow the promise.** Rename the mental category from “reading-time estimator” to “content-duration linter.” First release should add only:

1. `--min-minutes`, `--max-minutes`, stable exit codes, and one checked-in policy/config format.
2. `--explain` with the effective mode, rate, rounding, raw counts, and exclusions.
3. Explicit block policies for fenced code and Markdown images (include/exclude/fixed-seconds), because these create visible real-world disagreements.
4. `--locale` initially as explicit, documented profiles—not automatic detection. Fix Unicode sentence terminators and avoid marketing “CJK accurate” until validated on corpora.
5. True incremental streaming or stop presenting streaming as a memory advantage.

Measure success by CI adoption and reproducibility: same source + policy must yield the same output across machines, and users must be able to explain differences from Medium/Ghost. Avoid claiming universal accuracy; expose assumptions.

## Sources actually read

1. `reading-time` README (API, 200 WPM default, custom boundaries, stream, language caveat): https://github.com/ngryman/reading-time/blob/master/README.md
2. Medium Help, “Read time” (canonical display/method reference; page was Cloudflare-limited during audit): https://help.medium.com/hc/en-us/articles/214991667-Read-time
3. Ghost core `reading_time` helper (post-only use and translatable singular/plural labels): https://github.com/TryGhost/Ghost/blob/main/ghost/core/core/frontend/helpers/reading_time.js
4. Postlight Parser repository (article extraction boundary versus stripping): https://github.com/postlight/parser
5. Hemingway Editor site (editorial/readability workflow rather than badge-only estimation): https://hemingwayapp.com/
6. Substack Help, publishing a post (platform-controlled editor/preview/publish workflow; page was Cloudflare-limited during audit): https://support.substack.com/hc/en-us/articles/360037832191-How-do-I-publish-a-new-post

_Notes on evidence: source-code/README links were preferred where product help pages blocked automated access. Claims about this repository derive from direct local inspection._
