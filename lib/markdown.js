'use strict';
const { stripHtml } = require('./html');
function stripMarkdown(input) {
  let s = input.replace(/\r\n?/g, '\n');
  s = s.replace(/^---\n[\s\S]*?\n---\s*(?:\n|$)/, '');
  s = s.replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, ' ');
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/`([^`]*)`/g, '$1');
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '').replace(/^\s*>\s?/gm, '').replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, '');
  s = s.replace(/^\s*(?:[-*_]\s*){3,}$/gm, '');
  s = s.replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2');
  return stripHtml(s);
}
module.exports = { stripMarkdown };
