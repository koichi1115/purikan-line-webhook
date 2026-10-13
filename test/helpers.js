'use strict';
const { Readable } = require('node:stream');

/** Minimal Vercel-like response mock. */
function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    json(obj) { this.body = obj; return this; },
    send(data) { this.body = data; return this; },
  };
  return res;
}

/** Request mock. rawBody (string) is exposed as a readable stream. */
function createReq({ method = 'GET', headers = {}, query = {}, body, rawBody } = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  const stream = Readable.from(rawBody !== undefined ? [Buffer.from(rawBody)] : []);
  stream.method = method;
  stream.headers = lower;
  stream.query = query;
  stream.socket = { remoteAddress: '127.0.0.1' };
  if (body !== undefined) stream.body = body;
  return stream;
}

/** In-memory fake of the subset of Redis commands we use. */
function createFakeRedis() {
  const store = new Map();
  const calls = [];
  async function command(cmd, args = []) {
    calls.push([cmd, ...args]);
    switch (cmd) {
      case 'GET': return store.has(args[0]) ? store.get(args[0]) : null;
      case 'SET': store.set(args[0], args[1]); return 'OK';
      case 'DEL': { const had = store.delete(args[0]); return had ? 1 : 0; }
      case 'INCR': { const n = Number(store.get(args[0]) || 0) + 1; store.set(args[0], String(n)); return n; }
      case 'EXPIRE': return 1;
      case 'KEYS': {
        const prefix = args[0].replace(/\*$/, '');
        return [...store.keys()].filter((k) => k.startsWith(prefix));
      }
      default: throw new Error(`unsupported ${cmd}`);
    }
  }
  return { command, store, calls };
}

module.exports = { createReq, createRes, createFakeRedis };
