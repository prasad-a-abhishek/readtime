# @prasadaabhishek/readtime

[![npm version](https://img.shields.io/npm/v/@prasadaabhishek/readtime.svg)](https://www.npmjs.com/package/@prasadaabhishek/readtime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Fast reading time & word count estimator with embedded code block and image support.

## Quick Start

```bash
npm install @prasadaabhishek/readtime
```

```typescript
import { getReadTime } from '@prasadaabhishek/readtime';

const stats = getReadTime(markdownText);
console.log(`Read time: ${stats.humanizedDuration} (${stats.words} words)`);
```

## ⚡ Performance & Benchmarks

`@prasadaabhishek/readtime` calculates article reading times 6.5x faster than standard packages.

| Article Length | `@prasadaabhishek/readtime` | `reading-time` | Speed Advantage |
| :--- | :---: | :---: | :---: |
| **Short Post (300 words)** | ⚡ **0.012 ms** | 0.085 ms | **7.0x Faster** |
| **Medium Article (1,500 words)** | ⚡ **0.045 ms** | 0.290 ms | **6.4x Faster** |
| **Long Guide (10,000 words)** | ⚡ **0.280 ms** | 1.850 ms | **6.6x Faster** |

> **Replicate these results:** Run `node benchmarks/run_benchmark.js` directly inside this repository. See full matrix in [benchmarks/BENCHMARK.md](benchmarks/BENCHMARK.md).

## Features & API

- **Code Block Accounting:** Accurately accounts for technical reading speeds on code snippets (` ```js `).
- **Image Seconds Calculation:** Adds progressive reading delay for embedded images.
- **Humanized Formatting:** Returns `{ text: "3 min read", minutes: 3, words: 650 }`.

## License

MIT © [Abhishek Prasad](https://github.com/prasad-a-abhishek)