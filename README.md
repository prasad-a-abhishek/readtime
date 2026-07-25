# @prasadaabhishek/readtime

> Fast reading time & word count estimator with image and code block support.

## Quick Start

```bash
npm install @prasadaabhishek/readtime
```

```typescript
import { getReadTime } from '@prasadaabhishek/readtime';
const stats = getReadTime(markdownText);
```

## ⚡ Performance & Benchmarks

`@prasadaabhishek/readtime` calculates article reading times 6.5x faster than alternatives.

| Article Length | `@prasadaabhishek/readtime` | `reading-time` | Speed Advantage |
| :--- | :---: | :---: | :---: |
| **Short Post (300 words)** | ⚡ **0.012 ms** | 0.085 ms | **7.0x Faster** |
| **Medium Article (1,500 words)** | ⚡ **0.045 ms** | 0.290 ms | **6.4x Faster** |

> **Replicate these results:** Run `node benchmarks/run_benchmark.js` directly inside this repository. See full matrix in [benchmarks/BENCHMARK.md](benchmarks/BENCHMARK.md).

## License

MIT