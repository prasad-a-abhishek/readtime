'use strict';

const assertText = text => { if (typeof text !== 'string') throw new TypeError('text must be a string'); };
const CJK = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u;

function words(text) {
  assertText(text);
  let count = 0, token = false;
  for (const ch of text.replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu, '')) {
    if (CJK.test(ch)) { if (token) { count++; token = false; } count++; }
    else if (/[-\s]/u.test(ch) || ch === '\0') { if (token) { count++; token = false; } }
    else if (/[^\p{P}\p{S}]/u.test(ch) || ch === "'" || /[\p{S}]/u.test(ch)) token = true;
    else if (token && ch !== "'") { count++; token = false; }
  }
  return count + (token ? 1 : 0);
}
function chars(text, all = false) { assertText(text); return all ? [...text].length : [...text.replace(/\s/gu, '')].length; }
function sentences(text) {
  assertText(text);
  const clean = text.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr)\./gi, '').replace(/\b(?:e\.g|i\.e)\./gi, '');
  return (clean.match(/[.!?]+(?=\s|$)/g) || []).length;
}
function paragraphs(text) { assertText(text); return text.trim() ? text.trim().split(/(?:\r?\n|\r)\s*(?:\r?\n|\r)+/).filter(Boolean).length : 0; }
module.exports = { assertText, words, chars, sentences, paragraphs };
