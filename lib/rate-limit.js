'use strict';

/** Fixed-window counter. Returns true while under the limit. */
async function hitRateLimit(redis, key, limit, windowSec) {
  const count = await redis.command('INCR', [`rl:${key}`]);
  if (count === 1) await redis.command('EXPIRE', [`rl:${key}`, String(windowSec)]);
  return count <= limit;
}

function clientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { hitRateLimit, clientIp };
