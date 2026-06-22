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
    const errText = await res.text();
    console.error('Reply failed:', res.status, errText);
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

// --- Vercel Serverless Function ---

module.exports = async function handler(req, res) {
  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasSecret: !!process.env.LINE_CHANNEL_SECRET,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Read raw body (bodyParser is disabled)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf-8');

    // Verify signature
    const signature = req.headers['x-line-signature'];
    if (!signature || !verifySignature(rawBody, signature)) {
      return res.status(403).send('Invalid signature');
    }

    const parsed = JSON.parse(rawBody);

    // Process events
    for (const event of parsed.events || []) {
      if (event.type === 'follow') {
        const userId = event.source.userId;
        const deepLink = `${APP_SCHEME}://link-line?id=${userId}`;
        await replyMessage(event.replyToken, [
          { type: 'text', text: 'ぷりかん！公式アカウントへようこそ 🎉\nプリントの解析結果をLINEでお届けします。' },
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
        ]);
      } else if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        if (event.message.text.includes('連携')) {
          await replyMessage(event.replyToken, buildLinkMessage(userId));
        } else {
          await replyMessage(event.replyToken, [
            { type: 'text', text: '「連携」と送信すると、ぷりかん！アプリとの連携リンクをお送りします。' },
          ]);
        }
      }
    }

    return res.status(200).json({});
  } catch (e) {
    console.error('Webhook error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

// Must be set AFTER module.exports assignment
module.exports.config = { api: { bodyParser: false } };
