'use strict';
const defaults = Object.freeze({ wordsPerMinute: 200, format: 'short', minMinutes: 0.5, decimals: 1, countChars: 'nonWhitespace' });
function options(value = {}) {
  const o = { ...defaults, ...value };
  if (!Number.isFinite(o.wordsPerMinute) || o.wordsPerMinute <= 0) throw new RangeError('wordsPerMinute must be positive');
  if (!Number.isFinite(o.minMinutes) || o.minMinutes < 0) throw new RangeError('minMinutes must be non-negative');
  if (!Number.isInteger(o.decimals) || o.decimals < 0 || o.decimals > 10) throw new RangeError('decimals must be an integer from 0 to 10');
  if (!['short', 'long', 'tiny', 'json'].includes(o.format)) throw new RangeError('unknown format');
  return o;
}
function roundedMinutes(seconds, o) { if (!seconds) return 0; const raw = seconds / 60; return Number(Math.max(raw, o.minMinutes).toFixed(o.decimals)); }
function human(seconds, o) {
  // 'json' is reserved for the CLI / stats() output. human() is for
  // human-readable text, so reject json with a clear error.
  if (o.format === 'json') {
    throw new RangeError("format 'json' is for the CLI/--json flag; use human() with 'short', 'long', or 'tiny', or call stats() for structured output");
  }
  if (!seconds) return o.format === 'tiny' ? '0m' : '0 min read';
  if (o.format === 'tiny') {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.max(1, Math.round(seconds / 60))}m`;
  }
  if (o.format === 'long') {
    if (seconds < 60) return `${seconds} sec read`;
    const n = Math.max(1, Math.round(seconds / 60));
    return `${n} ${n === 1 ? 'minute' : 'minutes'} read`;
  }
  if (seconds <= 30) return `${seconds} sec read`;
  if (seconds < 60) return '< 1 min read';
  const n = Math.round(seconds / 60);
  return `${n} min read`;
}
module.exports = { defaults, options, roundedMinutes, human };
