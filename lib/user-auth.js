'use strict';
const crypto = require('crypto');
const { isLineUserId, isUserToken } = require('./ids');

const TOKEN_TTL_SEC = 400 * 86400;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const tokenKey = (hash) => `authtoken:${hash}`;
const userKey = (userId) => `usertoken:${userId}`;

/**
 * Issue a per-user secret (only called from a signature-verified LINE event).
 * Only the SHA-256 hash is stored; issuing a new one revokes the previous.
 */
async function issueUserToken(redis, userId) {
  if (!isLineUserId(userId)) throw new Error('invalid userId');
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = hashToken(token);
  const prev = await redis.command('GET', [userKey(userId)]);
  if (prev) await redis.command('DEL', [tokenKey(prev)]);
  await redis.command('SET', [tokenKey(hash), userId, 'EX', String(TOKEN_TTL_SEC)]);
  await redis.command('SET', [userKey(userId), hash, 'EX', String(TOKEN_TTL_SEC)]);
  return token;
}

/** Resolve a token to its LINE userId, or null. Lookup is by hash, so no secret comparison happens in JS. */
async function authenticateUser(redis, token) {
  if (!isUserToken(token)) return null;
  const userId = await redis.command('GET', [tokenKey(hashToken(token))]);
  return isLineUserId(userId) ? userId : null;
}

function bearerToken(req) {
  const h = req.headers && req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

module.exports = { issueUserToken, authenticateUser, bearerToken };
