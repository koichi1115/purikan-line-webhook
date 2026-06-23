/**
 * Cron job: Send LINE reminders for today's date.
 * Runs daily at 7:00 AM JST (22:00 UTC previous day).
 */

async function redisCommand(command, args = []) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');

  const res = await fetch(`${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
  });

  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function sendLinePush(channelAccessToken, lineUserId, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  });
  return res.ok;
}

module.exports = async function handler(req, res) {
  try {
    // Get today's date in JST
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = jst.toISOString().split('T')[0];

    console.log(`Checking reminders for ${today}`);

    // Find all reminders for today
    const keys = await redisCommand('KEYS', [`reminder:${today}:*`]);

    if (!keys || keys.length === 0) {
      console.log('No reminders for today');
      return res.status(200).json({ sent: 0 });
    }

    // Group reminders by user
    const byUser = {};
    for (const key of keys) {
      const data = await redisCommand('GET', [key]);
      if (!data) continue;
      const reminder = JSON.parse(data);
      const userId = reminder.lineUserId;
      if (!byUser[userId]) byUser[userId] = { token: reminder.channelAccessToken, items: [] };
      byUser[userId].items.push(reminder);
      // Delete the reminder after reading
      await redisCommand('DEL', [key]);
    }

    // Send grouped notifications
    let sent = 0;
    for (const [userId, { token, items }] of Object.entries(byUser)) {
      let message = '⏰ リマインダー\n';

      const todos = items.filter(i => i.type === 'todo');
      const itemList = items.filter(i => i.type === 'item');

      if (todos.length > 0) {
        message += '\n✔️ TODO:';
        todos.forEach(t => {
          message += `\n  - 【${t.targetPerson}】${t.title} (期限: ${t.dueDate})`;
        });
      }

      if (itemList.length > 0) {
        message += '\n\n🎒 持ち物:';
        itemList.forEach(i => {
          message += `\n  - 【${i.targetPerson}】${i.title} (期限: ${i.dueDate})`;
        });
      }

      const ok = await sendLinePush(token, userId, message);
      if (ok) sent++;
      console.log(`Sent to ${userId}: ${ok ? 'success' : 'failed'}`);
    }

    return res.status(200).json({ sent, total: keys.length });
  } catch (e) {
    console.error('Cron error:', e);
    return res.status(500).json({ error: e.message });
  }
};
