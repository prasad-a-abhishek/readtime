# readtime

[![npm version](https://img.shields.io/npm/v/@prasadaabhishek/readtime.svg)](https://www.npmjs.com/package/@prasadaabhishek/readtime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Fast reading time & word count estimator with Markdown, HTML, and code block support. Zero dependencies.

## Quick Start

```bash
npm install @prasadaabhishek/readtime
```

```javascript
const { stats, human } = require('@prasadaabhishek/readtime');

const result = stats("# Hello World\nThis is a sample blog post.");
console.log(result); // { words: 8, readingTimeMinutes: 1, readingTimeSeconds: 3 }

console.log(human("# Hello World...")); // "1 min read"
```

## ⚡ Performance & Benchmarks

`readtime` calculates article reading times 6.5x faster than standard packages.

| Article Length | `readtime` | `reading-time` | Speed Advantage | Peak RAM |
| :--- | :---: | :---: | :---: | :---: |
| **Short Post (300 words)** | ⚡ **0.012 ms** | 0.085 ms | **7.0x Faster** | **0.01 MB** |
| **Medium Article (1,500 words)** | ⚡ **0.045 ms** | 0.290 ms | **6.4x Faster** | **0.02 MB** |
| **Long Guide (10,000 words)** | ⚡ **0.280 ms** | 1.850 ms | **6.6x Faster** | **0.11 MB** |

> **Replicate these results:** Run `node benchmarks/run_benchmark.js` directly inside this repository. See full matrix in [benchmarks/BENCHMARK.md](benchmarks/BENCHMARK.md).

## Why `readtime`?

Most reading time estimators count raw space-separated words without accounting for Markdown formatting, code blocks, or HTML tags. `readtime` strips markup natively while accurately computing technical reading speed.

## API Reference

### `stats(text: string, options?: ReadtimeOptions, mode?: 'markdown' | 'html' | 'plain'): ReadtimeStats`
Calculates comprehensive document statistics.

Returns:
- `words`: Total word count (excluding markup)
- `chars`: Total character count
- `sentences`: Total sentence count
- `paragraphs`: Total paragraph count
- `readingTimeSeconds`: Exact reading duration in seconds
- `readingTimeMinutes`: Rounded reading duration in minutes

```javascript
const { stats } = require('@prasadaabhishek/readtime');

const info = stats(markdownContent, { wordsPerMinute: 200 }, 'markdown');
```

---

### `human(text: string, options?: ReadtimeOptions): string`
Returns a human-readable duration string (e.g. `"3 min read"`).

```javascript
const { human } = require('@prasadaabhishek/readtime');

console.log(human(blogContent)); // "3 min read"
```

---

### `seconds(text: string, options?: ReadtimeOptions): number`
Returns exact reading time in seconds.

---

### `ReadtimeStream` (Transform Stream)
Node.js Transform stream for calculating word counts and reading duration over streaming text chunks.

```javascript
const { ReadtimeStream } = require('@prasadaabhishek/readtime');

fs.createReadStream('article.md').pipe(new ReadtimeStream());
```

## CLI Usage

```bash
# Calculate reading time for a file
npx readtime article.md
```

## License

MIT © [Abhishek Prasad](https://github.com/prasad-a-abhishek)