'use strict';
const crypto = require('crypto');

const DAY_MS = 86400000;

function reminderDate(dueDate, daysBefore) {
  const due = new Date(`${dueDate}T00:00:00+09:00`);
  const jst = new Date(due.getTime() - daysBefore * DAY_MS + 9 * 3600e3);
  return { due, dateStr: jst.toISOString().split('T')[0] };
}

/** Persist a validated reminder for an authenticated user. */
async function saveReminder(redis, userId, input) {
  const { due, dateStr } = reminderDate(input.dueDate, input.daysBefore);
  const reminder = { lineUserId: userId, ...input, reminderDate: dateStr, createdAt: new Date().toISOString() };
  const key = `reminder:${dateStr}:${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
  const ttl = Math.max(Math.floor((due.getTime() - Date.now()) / 1000) + 86400, 86400);
  await redis.command('SET', [key, JSON.stringify(reminder), 'EX', String(ttl)]);
  return { key, reminderDate: dateStr };
}

module.exports = { saveReminder };
