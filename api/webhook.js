const crypto = require('crypto');

const APP_SCHEME = 'otayori-ai';

// --- LINE API helpers ---

async function replyMessage(replyToken, messages) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error('Reply failed:', res.status, await res.text());
  }
}

function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// --- Messages ---

function buildLinkMessage(userId) {
  const deepLink = `${APP_SCHEME}://link-line?id=${userId}`;
  return [
    {
      type: 'template',
      altText: 'ぷりかん！とLINEを連携します',
      template: {
        type: 'buttons',
        title: 'ぷりかん！LINE連携',
        text: '下のボタンをタップすると、ぷりかん！アプリとLINE通知が連携されます。',
        actions: [{ type: 'uri', label: '連携する', uri: deepLink }],
      },
    },
  ];
}

function buildWelcomeMessage(userId) {
  const deepLink = `${APP_SCHEME}://link-line?id=${userId}`;
  return [
    {
      type: 'text',
      text: 'ぷりかん！公式アカウントへようこそ 🎉\nプリントの解析結果をLINEでお届けします。',
    },
    {
      type: 'template',
      altText: 'ぷりかん！とLINEを連携します',
      template: {
        type: 'buttons',
        title: 'LINE連携',
        text: 'まずはアプリと連携しましょう！下のボタンをタップしてください。',
        actions: [{ type: 'uri', label: '連携する', uri: deepLink }],
      },
    },
  ];
}

// --- Event handling ---

async function handleEvent(event) {
  if (event.type === 'follow') {
    await replyMessage(event.replyToken, buildWelcomeMessage(event.source.userId));
    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const userId = event.source.userId;
    const text = event.message.text.trim();

    if (text.includes('連携')) {
      await replyMessage(event.replyToken, buildLinkMessage(userId));
      return;
    }

    await replyMessage(event.replyToken, [
      { type: 'text', text: '「連携」と送信すると、ぷりかん！アプリとの連携リンクをお送りします。' },
    ]);
  }
}

// --- Vercel Serverless Function ---

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('OK');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Read raw body for signature verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf-8');

  const signature = req.headers['x-line-signature'];
  if (!signature || !verifySignature(rawBody, signature)) {
    return res.status(403).send('Invalid signature');
  }

  const parsed = JSON.parse(rawBody);

  // Process events BEFORE responding (Vercel kills the function after res.end)
  for (const event of parsed.events || []) {
    try {
      await handleEvent(event);
    } catch (e) {
      console.error('Event handling error:', e);
    }
  }

  return res.status(200).json({});
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
