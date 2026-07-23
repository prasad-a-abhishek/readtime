#!/usr/bin/env node
'use strict';
const fs = require('node:fs'); const path = require('node:path'); const rt = require('..');
const HELP = `Usage: readtime [options] <file|->
Options:
  --stdin          Read standard input
  --wpm <number>   Words per minute (default 200)
  --format <type>  short, long, tiny, or json
  --html           Parse as HTML
  --markdown       Parse as Markdown
  --help           Show help
  --version        Show version`;
async function main() {
  const a = process.argv.slice(2);
  if (a.includes('--help')) return console.log(HELP);
  if (a.includes('--version')) return console.log(require('../package.json').version);
  let opts = {}, mode = 'markdown', file, stdinFlag = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--stdin') stdinFlag = true;
    else if (x === '-') file = '-';
    else if (x === '--wpm') opts.wordsPerMinute = Number(a[++i]);
    else if (x === '--format') opts.format = a[++i];
    else if (x === '--html') mode = 'html';
    else if (x === '--markdown') mode = 'markdown';
    else if (x.startsWith('-')) throw Error(`Unknown option: ${x}`);
    else file = x;
  }
  if (stdinFlag && file && file !== '-') {
    throw Error('Cannot specify both --stdin and a file. Use --stdin alone, or pass a file path without --stdin.');
  }
  if (stdinFlag) file = '-';
  if (!file) throw Error('No input file. Use --stdin or specify a file.');
  const text = file === '-'
    ? await new Promise((resolve, reject) => {
        let s = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', c => (s += c)).on('end', () => resolve(s)).on('error', reject);
      })
    : fs.readFileSync(path.resolve(file), 'utf8');
  const result = rt.stats(text, opts, mode);
  console.log(opts.format === 'json' ? JSON.stringify(result, null, 2) : rt.human(text, opts));
}
main().catch(e => { console.error(`readtime: ${e.message}`); process.exitCode = 1; });
