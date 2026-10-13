/**
 * LINE Messaging API webhook. Every POST must carry a valid x-line-signature
 * (HMAC-SHA256 of the raw body with LINE_CHANNEL_SECRET); otherwise 401.
 */
const { createRedis } = require('../lib/redis');
const { verifyLineSignature, readRawBody } = require('../lib/line-signature');
const { replyMessage } = require('../lib/line-api');
const { issueUserToken } = require('../lib/user-auth');
const { isLineUserId } = require('../lib/ids');
const { buildLinkUrl } = require('../lib/link-page');

const MAX_BODY_BYTES = 1024 * 1024;

function linkTemplate(linkUrl, altText, title, text) {
  return { type: 'template', altText, template: { type: 'buttons', title, text, actions: [{ type: 'uri', label: '連携する', uri: linkUrl }] } };
}

const GROUP_NOTICE = [{ type: 'text', text: '連携は、ぷりかん！公式アカウントとの1対1のトークで「連携」と送ってください。' }];

async function messagesFor(event, redis) {
  // Never issue a token where others can see the reply (group / room).
  if (!event.source || event.source.type !== 'user') {
    const text = (event.message && event.message.text) || '';
    return event.type === 'message' && text.includes('連携') ? GROUP_NOTICE : null;
  }
  const userId = event.source && event.source.userId;
  const text = (event.message && event.message.text) || '';
  if (event.type === 'message' && !text.includes('連携')) {
    return [{ type: 'text', text: '「連携」と送ると、アプリとの連携リンクをお送りします。' }];
  }
  if (event.type !== 'follow' && event.type !== 'message') return null;
  if (!isLineUserId(userId)) return null;
  const linkUrl = buildLinkUrl(userId, await issueUserToken(redis, userId));
  if (event.type === 'follow') {
    return [
      { type: 'text', text: 'ぷりかん！へようこそ 🎉\nアプリと連携して通知を受け取りましょう。' },
      linkTemplate(linkUrl, '連携リンク', 'LINE連携', 'ボタンをタップしてアプリと連携'),
    ];
  }
  return [linkTemplate(linkUrl, 'ぷりかん！とLINEを連携します', 'ぷりかん！LINE連携', '下のボタンをタップすると、ぷりかん！アプリとLINE通知が連携されます。')];
}

function createHandler({ redis = createRedis(), reply = replyMessage, getSecret = () => process.env.LINE_CHANNEL_SECRET } = {}) {
  return async function handler(req, res) {
    if (req.method === 'GET') return res.status(200).json({ status: 'ok' });
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    let raw;
    try {
      raw = await readRawBody(req, MAX_BODY_BYTES);
    } catch (e) {
      if (e.code === 'BODY_TOO_LARGE') return res.status(413).json({ error: 'payload_too_large' });
      throw e;
    }
    if (!verifyLineSignature(raw, req.headers['x-line-signature'], getSecret())) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
    try {
      const body = JSON.parse(raw.toString('utf8'));
      for (const event of body.events || []) {
        const messages = await messagesFor(event, redis);
        if (messages && event.replyToken) await reply(event.replyToken, messages);
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('Webhook error');
      return res.status(500).json({ error: 'internal_error' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
// Keep the request stream unparsed so the signature is checked against the raw body.
module.exports.config = { api: { bodyParser: false } };
