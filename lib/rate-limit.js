'use strict';

/**
 * Fixed-window counter. Returns true while under the limit.
 * SET NX EX creates the window with its TTL atomically; INCR keeps the TTL,
 * so a key can never be left without expiry.
 */
async function hitRateLimit(redis, key, limit, windowSec) {
  const k = `rl:${key}`;
  await redis.command('SET', [k, '0', 'EX', String(windowSec), 'NX']);
  const count = await redis.command('INCR', [k]);
  return count <= limit;
}

function clientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { hitRateLimit, clientIp };
