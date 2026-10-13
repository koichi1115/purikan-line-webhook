/**
 * Cron job: Send LINE reminders for today's date.
 * Runs daily at 7:00 AM JST (22:00 UTC previous day).
 * Requires Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends it when CRON_SECRET is set).
 */
const { createRedis } = require('../../lib/redis');
const { isAuthorizedCron } = require('../../lib/cron-auth');
const { pushText } = require('../../lib/line-api');
const { buildReminderMessage, groupBy } = require('../../lib/reminder-message');

function jstToday() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().split('T')[0];
}

/** Read and delete all due reminders (today and missed past dates). */
async function takeDueReminders(redis, today) {
  const allKeys = (await redis.command('KEYS', ['reminder:*'])) || [];
  const keys = allKeys.filter((k) => { const d = k.split(':')[1]; return d && d <= today; });
  const reminders = [];
  for (const key of keys) {
    const data = await redis.command('GET', [key]);
    await redis.command('DEL', [key]);
    if (data) reminders.push(JSON.parse(data));
  }
  return { reminders, total: keys.length };
}

function createHandler({ redis = createRedis(), sendPush = pushText, getSecret = () => process.env.CRON_SECRET } = {}) {
  return async function handler(req, res) {
    if (!isAuthorizedCron(req, getSecret())) return res.status(401).json({ error: 'unauthorized' });
    try {
      const { reminders, total } = await takeDueReminders(redis, jstToday());
      let sent = 0;
      let failed = 0;
      for (const [userId, items] of Object.entries(groupBy(reminders, (r) => r.lineUserId))) {
        if (await sendPush(userId, buildReminderMessage(items))) sent++; else failed++;
      }
      console.log(`Reminders: sent=${sent} failed=${failed} total=${total}`);
      return res.status(200).json({ sent, total });
    } catch (e) {
      console.error('Cron error');
      return res.status(500).json({ error: 'internal_error' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
