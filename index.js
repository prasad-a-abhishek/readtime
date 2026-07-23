'use strict';
const { words, chars, sentences, paragraphs, assertText } = require('./lib/count');
const { stripHtml } = require('./lib/html');
const { stripMarkdown } = require('./lib/markdown');
const fmt = require('./lib/format');
function prepare(text, mode) { assertText(text); return mode === 'html' ? stripHtml(text) : mode === 'plain' ? text : stripMarkdown(text); }
function stats(text, value = {}, mode = 'markdown') {
  const o = fmt.options(value), clean = prepare(text, mode), n = words(clean);
  const readingTimeSeconds = n ? Math.max(1, Math.ceil(n / o.wordsPerMinute * 60)) : 0;
  return { words: n, chars: chars(clean, o.countChars === 'all'), sentences: sentences(clean), paragraphs: paragraphs(clean), readingTimeSeconds, readingTimeMinutes: fmt.roundedMinutes(readingTimeSeconds, o), wordsPerMinute: o.wordsPerMinute, format: o.format };
}
function seconds(text, o) { return stats(text, o).readingTimeSeconds; }
function minutes(text, o) { return stats(text, o).readingTimeMinutes; }
function human(text, value = {}) { const o = fmt.options(value); return fmt.human(seconds(text, o), o); }
function html(text, o) { return stats(text, o, 'html'); }
function markdown(text, o) { return stats(text, o, 'markdown'); }
const { ReadtimeStream } = require('./lib/stream');
module.exports = { seconds, minutes, human, stats, html, markdown, ReadtimeStream, defaults: fmt.defaults };
