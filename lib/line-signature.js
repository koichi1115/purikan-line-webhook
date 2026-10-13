'use strict';
const crypto = require('crypto');
const { safeEqual } = require('./secure-compare');

/** Verify x-line-signature (base64 HMAC-SHA256 of the raw body). Fail-closed. */
function verifyLineSignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || rawBody === undefined || rawBody === null) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return safeEqual(expected, signature);
}

/** Read the unparsed request body as a Buffer; throws code BODY_TOO_LARGE past maxBytes. */
async function readRawBody(req, maxBytes = Infinity) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      const err = new Error('Body too large');
      err.code = 'BODY_TOO_LARGE';
      throw err;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

module.exports = { verifyLineSignature, readRawBody };
