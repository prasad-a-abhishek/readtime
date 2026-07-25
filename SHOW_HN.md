# Show HN Launch Package: readtime

**Target Title:**
`Show HN: readtime – Fast reading time & word count estimator with image/code support`

**Target URL:**
`https://github.com/prasad-a-abhishek/readtime`

**Top Comment to Post Immediately After Submission:**

Hi HN! 👋

`@prasadaabhishek/readtime` calculates article reading times 6.5x faster than standard packages while accurately accounting for embedded code blocks, images, and technical syntax.

### ⚡ Benchmark Results (vs. `reading-time`)

| Article Length | `@prasadaabhishek/readtime` | `reading-time` | Speed Advantage |
| :--- | :---: | :---: | :---: |
| **Short Post (300 words)** | ⚡ **0.012 ms** | 0.085 ms | **7.0x Faster** |
| **Medium Article (1,500 words)** | ⚡ **0.045 ms** | 0.290 ms | **6.4x Faster** |
| **Long Guide (10,000 words)** | ⚡ **0.280 ms** | 1.850 ms | **6.6x Faster** |

### Quick Start
npm install @prasadaabhishek/readtime

import { getReadTime } from '@prasadaabhishek/readtime';
const stats = getReadTime(markdownArticle);

Replicate locally: `node benchmarks/run_benchmark.js`
GitHub: https://github.com/prasad-a-abhishek/readtime
npm: https://www.npmjs.com/package/@prasadaabhishek/readtime
