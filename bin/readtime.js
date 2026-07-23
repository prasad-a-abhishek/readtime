#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const rt = require('..');
const { lint, validatePolicy } = require('../lib/policy');

// Exit codes:
//   0 = clean (or no policy violated)
//   1 = input/usage error (cannot read file, bad arg)
//   2 = policy violation (configurable via --exit-on-violation)
//   3 = internal error (library threw)
const HELP = `Usage: readtime [options] <file|->

Input:
  <file>            Path to file. Use - for stdin.
  --stdin           Read standard input
  --markdown        Parse as Markdown (default)
  --html            Parse as HTML
  --plain           Parse as plain text (no preprocessing)

Counting:
  --wpm <number>    Words per minute (default 200)
  --format <type>   short | long | tiny | json (default: short)

Policy lint (exit 0 if in budget, 2 if violated):
  --min-minutes N        Document must be at least N minutes
  --max-minutes N        Document must be at most N minutes
  --min-words N          Document must have at least N words
  --max-words N          Document must have at most N words
  --fail-on over|under|any
                         Which side of a budget to enforce (default over)
  --policy FILE          JSON file with policy fields merged after flags
  --explain              Print a multi-line explanation to stderr
  --exit-on-violation N  Exit code when the budget is violated (default 2)

  Example policy file (readtime.policy.json):
    { "maxMinutes": 7, "minMinutes": 4, "wpm": 220, "mode": "markdown" }

Other:
  --help            Show help
  --version         Show version`;

function parseArgs(argv) {
  const out = {
    flags: {},
    mode: 'markdown',
    file: null,
    stdinFlag: false,
    showHelp: false,
    showVersion: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const next = () => argv[++i];
    switch (x) {
      case '--help':    out.showHelp = true; break;
      case '--version': out.showVersion = true; break;
      case '--stdin':   out.stdinFlag = true; break;
      case '-':         out.file = '-'; break;
      case '--wpm':     out.flags.wordsPerMinute = Number(next()); break;
      case '--format':  out.flags.format = next(); break;
      case '--html':    out.mode = 'html'; break;
      case '--markdown':out.mode = 'markdown'; break;
      case '--plain':   out.mode = 'plain'; break;
      case '--min-minutes': out.flags.minMinutes = Number(next()); break;
      case '--max-minutes': out.flags.maxMinutes = Number(next()); break;
      case '--min-words':   out.flags.minWords = Number(next()); break;
      case '--max-words':   out.flags.maxWords = Number(next()); break;
      case '--fail-on':     out.flags.failOn = next(); break;
      case '--policy':      out.flags.__policyFile = next(); break;
      case '--explain':     out.flags.explain = true; break;
      case '--exit-on-violation': out.__exitOnViolation = Number(next()); break;
      default:
        if (x.startsWith('-')) throw new Error(`Unknown option: ${x}`);
        if (out.file != null) throw new Error(`Unexpected extra path: ${x}`);
        out.file = x;
    }
  }
  return out;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => (s += c)).on('end', () => resolve(s)).on('error', reject);
  });
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`readtime: ${e.message}\n`);
    process.stdout.write(HELP + '\n');
    process.exit(1);
  }

  if (parsed.showHelp)    { process.stdout.write(HELP + '\n'); return; }
  if (parsed.showVersion) { process.stdout.write(require('../package.json').version + '\n'); return; }

  if (parsed.stdinFlag && parsed.file && parsed.file !== '-') {
    process.stderr.write('readtime: cannot combine --stdin with a file path\n');
    process.exit(1);
  }
  if (parsed.stdinFlag) parsed.file = '-';
  if (!parsed.file) {
    process.stderr.write('readtime: no input. Use --stdin, pass a file, or "-\"\n');
    process.exit(1);
  }

  // Load a policy file if --policy was supplied. Strip that key out
  // before passing to lint(), which has its own __filePolicy convention.
  let filePolicy = {};
  if (parsed.flags.__policyFile) {
    const polPath = path.resolve(parsed.flags.__policyFile);
    try {
      const raw = fs.readFileSync(polPath, 'utf8');
      filePolicy = JSON.parse(raw);
    } catch (e) {
      process.stderr.write(`readtime: cannot read policy file ${polPath}: ${e.message}\n`);
      process.exit(1);
    }
    // Validate the policy file independently so the user gets a clear
    // error pointing at the file, not at lint-time.
    const v = validatePolicy(filePolicy);
    if (!v.ok) {
      process.stderr.write(`readtime: invalid policy file ${polPath}:\n  - ${v.errors.join('\n  - ')}\n`);
      process.exit(1);
    }
    delete parsed.flags.__policyFile;
  }

  let text;
  try {
    text = parsed.file === '-'
      ? await readStdin()
      : fs.readFileSync(path.resolve(parsed.file), 'utf8');
  } catch (e) {
    process.stderr.write(`readtime: ${e.message}\n`);
    process.exit(1);
  }

  // Pre-merge: if the user passed any policy field on the CLI, lint
  // runs through that path. Otherwise (only filePolicy) lint does the
  // merge internally. We pass filePolicy under a non-documented key.
  const flags = { ...parsed.flags };
  if (Object.keys(filePolicy).length) flags.__filePolicy = filePolicy;

  // Detect whether the user asked for policy enforcement at all. If yes,
  // route through lint() so we can compute violation exit codes and
  // optional --explain diagnostics.
  const usingPolicy =
    flags.minMinutes != null || flags.maxMinutes != null ||
    flags.minWords != null   || flags.maxWords != null   ||
    flags.failOn != null     || flags.explain ||
    Object.keys(filePolicy).length > 0;

  if (usingPolicy) {
    let result;
    try {
      result = lint(text, flags);
    } catch (e) {
      process.stderr.write(`readtime: ${e.message}\n`);
      process.exit(1);
    }
    // Default human output even on violation: convenient for CI logs.
    const human = rt.human(text, { wordsPerMinute: result.policy.wpm || 200 });
    if (result.policy.explain) {
      process.stderr.write(result.explain + '\n');
    }
    if (result.violations.length) {
      for (const v of result.violations) {
        process.stderr.write(`policy violation: ${v.kind} actual=${v.actual} limit=${v.limit}\n`);
      }
      process.stdout.write(human + '\n');
      const exitCode = parsed.__exitOnViolation || 2;
      process.exit(exitCode);
    }
    process.stdout.write(human + '\n');
    return;
  }

  // No policy: original behavior — print the requested format.
  process.stdout.write(parsed.flags.format === 'json'
    ? JSON.stringify(rt.stats(text, parsed.flags, parsed.mode), null, 2) + '\n'
    : rt.human(text, parsed.flags) + '\n');
}

main().catch(e => {
  process.stderr.write(`readtime: ${e.message}\n`);
  process.exit(3);
});
