'use strict';
const { Transform } = require('node:stream');
class ReadtimeStream extends Transform {
  constructor(options = {}) { super(); this.readtimeOptions = options; this.chunks = []; this.readingTimeSeconds = 0; }
  _transform(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); this.push(chunk); callback(); }
  _flush(callback) { try { this.readingTimeSeconds = require('..').seconds(Buffer.concat(this.chunks).toString(), this.readtimeOptions); callback(); } catch (e) { callback(e); } }
}
module.exports = { ReadtimeStream };
