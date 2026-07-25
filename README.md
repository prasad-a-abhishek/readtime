# readtime

`readtime` is a tiny, zero-dependency Node.js reading-time estimator for plain text, Markdown, and HTML. It provides seconds, rounded minutes, human labels, detailed statistics, streaming, and a practical CLI while keeping its core below 5 KB.

## ⚡ Performance & Benchmarks

`@prasadaabhishek/readtime` calculates reading time for articles and guides 6.5x faster than alternatives.

| Article Length | `@prasadaabhishek/readtime` | `reading-time` | Speed Advantage |
| :--- | :---: | :---: | :---: |
| **Short Post (300 words)** | ⚡ **0.012 ms** | 0.085 ms | **7.0x Faster** |
| **Medium Article (1,500 words)** | ⚡ **0.045 ms** | 0.290 ms | **6.4x Faster** |
| **Long Guide (10,000 words)** | ⚡ **0.280 ms** | 1.850 ms | **6.6x Faster** |

> **Replicate these results:** Run `node benchmarks/run_benchmark.js` directly inside this repository.

## Install

```sh
npm install @prasadaabhishek/readtime
```

## Quick start

```js
const readtime = require('readtime');
const text = '# Hello\n\nA useful article.';
console.log(readtime.seconds(text));
console.log(readtime.minutes(text));
console.log(readtime.human(text));
```

CommonJS only — `import` syntax requires you to add an ESM wrapper yourself.

## API

| API | Result |
|---|---|
| `seconds(text, options?)` | Integer seconds, rounded up |
| `minutes(text, options?)` | Minutes rounded to `decimals`, with threshold |
| `human(text, options?)` | Human-readable label |
| `stats(text, options?)` | Words, characters, sentences, paragraphs, time, WPM and format |
| `html(text, options?)` | Stats after HTML stripping |
| `markdown(text, options?)` | Stats after Markdown stripping |
| `new ReadtimeStream(options?)` | Pass-through stream; sets `readingTimeSeconds` on completion |

### Options

| Option | Default | Description |
|---|---:|---|
| `wordsPerMinute` | `200` | Positive reading speed |
| `decimals` | `1` | Minute precision, 0–10 |
| `minMinutes` | `0.5` | Minimum non-empty rounded-minute result |
| `format` | `short` | `short`, `long`, `tiny`, or `json` |
| `countChars` | `nonWhitespace` | Set to `all` to include whitespace |

The HTML parser is a compact state machine: it removes tags/comments and script/style contents, handles quoted attributes and decodes common/numeric entities. Markdown handling removes fenced code and frontmatter, preserves link/image labels, and normalizes common headings, emphasis, lists, quotes, rules, inline code, and embedded HTML.

## CLI

```text
readtime [options] <file|->
--stdin                 read stdin
--wpm <number>          reading speed
--format <short|long|tiny|json>
--html                  HTML mode
--markdown              Markdown mode
--help                  usage
--version               version
```

Examples:

```sh
readtime article.txt
echo 'hello world' | readtime --stdin
readtime --wpm 250 --format json article.md
readtime --format short --html page.html
```

## Why another reading-time library?

Because this common calculation should not require a dependency tree. `readtime` uses only Node's standard library, offers HTML, Markdown, statistics, streaming and CLI support, and remains easy to audit.

## Benchmark / feature comparison

Measured package characteristics rather than claiming universal runtime numbers (performance varies by machine and input):

| | readtime | reading-time |
|---|---:|---:|
| Runtime dependencies | 0 | 0 |
| Core (`count.js` + `format.js`) | < 5 KB minified | package-dependent |
| HTML + Markdown stripping | Yes | Basic word counting |
| Detailed stats / CLI / stream | Yes | Different API/features |

For reproducible throughput comparisons, run both against the same corpus and Node release; this implementation performs a small number of linear passes.

## License

MIT