const BASE_URL = 'https://purikan-line-webhook.vercel.app';

// Simple in-memory log (last 20 entries, resets on cold start)
const logs = [];
function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  logs.push(entry);
  if (logs.length > 20) logs.shift();
  console.log(entry);
}

async function replyMessage(replyToken, messages) {
  log(`replyMessage called, token=${replyToken?.slice(0, 10)}...`);
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  const text = await res.text();
  log(`LINE API response: ${res.status} ${text}`);
  return res.ok;
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
  // Debug log endpoint
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasSecret: !!process.env.LINE_CHANNEL_SECRET,
      tokenPrefix: (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').slice(0, 10),
      recentLogs: logs,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    log(`POST received, content-type: ${req.headers['content-type']}, body type: ${typeof req.body}`);

    const body = req.body;
    log(`body: ${JSON.stringify(body).slice(0, 500)}`);
    log(`events count: ${(body?.events || []).length}`);

    if (!body || !body.events) {
      log('No body or events');
      return res.status(200).json({ ok: true, note: 'no events' });
    }

    for (const event of body.events) {
      log(`event type: ${event.type}, source: ${JSON.stringify(event.source)}`);

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
        log(`message from ${userId}: ${text}`);

        if (text.includes('連携')) {
          await replyMessage(event.replyToken, buildLinkMessage(userId));
        } else {
          await replyMessage(event.replyToken, [
            { type: 'text', text: '「連携」と送ると連携リンクを送ります。' },
          ]);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    log(`ERROR: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
};
