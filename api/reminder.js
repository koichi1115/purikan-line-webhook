/**
 * POST /api/reminder - Register a reminder
 * GET /api/reminder - List all reminders (debug)
 *
 * Uses Upstash Redis REST API for storage.
 * Environment variables: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

async function redisCommand(command, args = []) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
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

module.exports = async function handler(req, res) {
  // Debug: list all reminders
  if (req.method === 'GET') {
    try {
      const keys = await redisCommand('KEYS', ['reminder:*']);
      const reminders = [];
      for (const key of keys || []) {
        const data = await redisCommand('GET', [key]);
        if (data) reminders.push(JSON.parse(data));
      }
      return res.status(200).json({ count: reminders.length, reminders });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { lineUserId, title, dueDate, targetPerson, type, daysBefore, documentTitle, driveFileId } = req.body;

    if (!lineUserId || !dueDate || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate reminder date
    const due = new Date(dueDate + 'T00:00:00+09:00');
    const reminderDate = new Date(due);
    reminderDate.setDate(reminderDate.getDate() - (daysBefore || 1));
    const reminderDateStr = reminderDate.toISOString().split('T')[0];

    const reminder = {
      lineUserId,
      title,
      dueDate,
      targetPerson,
      type,
      daysBefore: daysBefore || 1,
      reminderDate: reminderDateStr,
      documentTitle: documentTitle || null,
      driveFileId: driveFileId || null,
      createdAt: new Date().toISOString(),
    };

    // Store with key: reminder:{reminderDate}:{random}
    const key = `reminder:${reminderDateStr}:${Date.now()}`;
    // Expire after due date + 1 day (in seconds)
    const ttl = Math.max(Math.floor((due.getTime() - Date.now()) / 1000) + 86400, 86400);
    await redisCommand('SET', [key, JSON.stringify(reminder), 'EX', String(ttl)]);

    return res.status(200).json({ ok: true, reminderDate: reminderDateStr });
  } catch (e) {
    console.error('Reminder error:', e);
    return res.status(500).json({ error: e.message });
  }
};
