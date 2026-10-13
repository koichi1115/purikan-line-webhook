'use strict';
const crypto = require('crypto');
const { safeEqual } = require('./secure-compare');

/** Verify x-line-signature (base64 HMAC-SHA256 of the raw body). Fail-closed. */
function verifyLineSignature(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || rawBody === undefined || rawBody === null) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return safeEqual(expected, signature);
}

/** Read the unparsed request body as a Buffer. */
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = { verifyLineSignature, readRawBody };
