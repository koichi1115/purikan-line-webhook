'use strict';

async function callLine(path, payload) {
  const res = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error(`LINE ${path} failed:`, res.status);
  return res.ok;
}

const replyMessage = (replyToken, messages) => callLine('reply', { replyToken, messages });
const pushText = (to, text) => callLine('push', { to, messages: [{ type: 'text', text }] });

module.exports = { replyMessage, pushText };
