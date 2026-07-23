'use strict';
const entities = { amp: '&', nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s) { return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (_, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (entities[e.toLowerCase()] ?? ' ')); }
function stripHtml(input) {
  let out = '', i = 0, hidden = null;
  while (i < input.length) {
    if (input.startsWith('<!--', i)) { const e = input.indexOf('-->', i + 4); i = e < 0 ? input.length : e + 3; continue; }
    if (input[i] === '<') {
      let j = i + 1, quote = null;
      while (j < input.length) { const c = input[j]; if (quote) { if (c === quote) quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '>') break; j++; }
      if (j >= input.length) { i++; continue; }
      const tag = input.slice(i + 1, j).trim(); const m = tag.match(/^\/?\s*([\w-]+)/); const name = m?.[1].toLowerCase();
      if (!tag.startsWith('/') && (name === 'script' || name === 'style')) hidden = name;
      else if (tag.startsWith('/') && name === hidden) hidden = null;
      if (!hidden && /^(?:br|p|div|li|h[1-6])\b/i.test(tag.replace(/^\//, ''))) out += ' ';
      i = j + 1; continue;
    }
    if (!hidden) out += input[i]; i++;
  }
  return decode(out);
}
module.exports = { stripHtml, decode };
