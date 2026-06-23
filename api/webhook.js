const crypto = require('crypto');

const BASE_URL = 'https://purikan-line-webhook.vercel.app';

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

function buildLinkMessage(userId) {
  const linkUrl = `${BASE_URL}/api/link?id=${userId}`;
  return [
    {
      type: 'template',
      altText: 'ぷりかん！とLINEを連携します',
      template: {
        type: 'buttons',
        title: 'ぷりかん！LINE連携',
        text: '下のボタンをタップすると、ぷりかん！アプリとLINE通知が連携されます。',
        actions: [{ type: 'uri', label: '連携する', uri: linkUrl }],
      },
    },
  ];
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body;

    for (const event of body.events || []) {
      if (event.type === 'follow') {
        const userId = event.source.userId;
        const linkUrl = `${BASE_URL}/api/link?id=${userId}`;
        await replyMessage(event.replyToken, [
          { type: 'text', text: 'ぷりかん！へようこそ 🎉\nアプリと連携して通知を受け取りましょう。' },
          {
            type: 'template',
            altText: '連携リンク',
            template: {
              type: 'buttons',
              title: 'LINE連携',
              text: 'ボタンをタップしてアプリと連携',
              actions: [{ type: 'uri', label: '連携する', uri: linkUrl }],
            },
          },
        ]);
      } else if (event.type === 'message') {
        const userId = event.source.userId;
        const text = event.message?.text || '';

        if (text.includes('連携')) {
          await replyMessage(event.replyToken, buildLinkMessage(userId));
        } else {
          await replyMessage(event.replyToken, [
            { type: 'text', text: '「連携」と送ると、アプリとの連携リンクをお送りします。' },
          ]);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
