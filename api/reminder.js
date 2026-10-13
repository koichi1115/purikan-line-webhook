/**
 * POST /api/reminder - Register a reminder for the authenticated LINE user.
 *
 * Auth: Authorization: Bearer <per-user token issued via the LINE link flow>.
 * The LINE userId is derived from the token; any lineUserId in the body is ignored.
 * GET (list all) and DELETE (delete any key) were removed (A2B hardening).
 */
const { createRedis } = require('../lib/redis');
const { authenticateUser, bearerToken } = require('../lib/user-auth');
const { hitRateLimit, clientIp } = require('../lib/rate-limit');
const { validateReminder } = require('../lib/reminder-validate');
const { saveReminder } = require('../lib/reminder-store');

const IP_LIMIT = { limit: 30, windowSec: 60 };
const USER_LIMIT = { limit: 100, windowSec: 86400 };

function createHandler({ redis = createRedis() } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    try {
      if (!(await hitRateLimit(redis, `ip:${clientIp(req)}`, IP_LIMIT.limit, IP_LIMIT.windowSec))) {
        return res.status(429).json({ error: 'rate_limited' });
      }
      const userId = await authenticateUser(redis, bearerToken(req));
      if (!userId) return res.status(401).json({ error: 'unauthorized' });
      if (!(await hitRateLimit(redis, `user:${userId}`, USER_LIMIT.limit, USER_LIMIT.windowSec))) {
        return res.status(429).json({ error: 'rate_limited' });
      }
      const input = validateReminder(req.body);
      if (!input.ok) return res.status(400).json({ error: 'invalid_input', field: input.field });
      const saved = await saveReminder(redis, userId, input.value);
      return res.status(200).json({ ok: true, ...saved });
    } catch (e) {
      console.error('Reminder error');
      return res.status(500).json({ error: 'internal_error' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
