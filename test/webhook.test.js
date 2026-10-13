'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createReq, createRes, createFakeRedis } = require('./helpers');
const { createHandler } = require('../api/webhook');
const { verifyLineSignature } = require('../lib/line-signature');
const { authenticateUser } = require('../lib/user-auth');

const SECRET = 'test-channel-secret';
const USER = 'U' + 'd'.repeat(32);

function sign(raw, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(raw).digest('base64');
}

function makeHandler(secret = SECRET) {
  const replies = [];
  const redis = createFakeRedis();
  const handler = createHandler({
    redis,
    getSecret: () => secret,
    reply: async (token, messages) => { replies.push({ token, messages }); },
  });
  return { handler, replies, redis };
}

const raw = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId: USER }, message: { type: 'text', text: '連携' } }] });

test('webhook: 署名なし POST は 401 で返信しない', async () => {
  const { handler, replies } = makeHandler();
  const res = createRes();
  await handler(createReq({ method: 'POST', rawBody: raw }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(replies.length, 0);
});

test('webhook: 署名不一致（改ざん body）は 401', async () => {
  const { handler, replies } = makeHandler();
  const res = createRes();
  await handler(createReq({ method: 'POST', rawBody: raw + ' ', headers: { 'x-line-signature': sign(raw) } }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(replies.length, 0);
});

test('webhook: LINE_CHANNEL_SECRET 未設定なら 401（fail-closed）', async () => {
  const { handler } = makeHandler('');
  const res = createRes();
  await handler(createReq({ method: 'POST', rawBody: raw, headers: { 'x-line-signature': sign(raw) } }), res);
  assert.equal(res.statusCode, 401);
});

test('webhook: 正しい署名で処理し、連携リンクに端末トークンを含める', async () => {
  const { handler, replies, redis } = makeHandler();
  const res = createRes();
  await handler(createReq({ method: 'POST', rawBody: raw, headers: { 'x-line-signature': sign(raw) } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(replies.length, 1);
  const uri = replies[0].messages[0].template.actions[0].uri;
  const u = new URL(uri);
  assert.equal(u.searchParams.get('id'), USER);
  const token = u.searchParams.get('t');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await authenticateUser(redis, token), USER);
});

test('webhook: 不正な userId のイベントにはトークンを発行しない', async () => {
  const { handler, replies } = makeHandler();
  const bad = JSON.stringify({ events: [{ type: 'follow', replyToken: 'rt', source: { userId: '<script>' } }] });
  const res = createRes();
  await handler(createReq({ method: 'POST', rawBody: bad, headers: { 'x-line-signature': sign(bad) } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(replies.length, 0);
});

test('verifyLineSignature: 定数時間比較で長さ違いも false', () => {
  assert.equal(verifyLineSignature(raw, sign(raw), SECRET), true);
  assert.equal(verifyLineSignature(raw, 'short', SECRET), false);
  assert.equal(verifyLineSignature(raw, sign(raw, 'other'), SECRET), false);
  assert.equal(verifyLineSignature(raw, undefined, SECRET), false);
});

for (const sourceType of ['group', 'room']) {
  for (const ev of [
    { type: 'follow' },
    { type: 'message', message: { type: 'text', text: '連携' } },
  ]) {
    test(`webhook: source.type=${sourceType} の ${ev.type} ではトークンを発行せず返信に t= を含めない`, async () => {
      const { handler, replies, redis } = makeHandler();
      const body = JSON.stringify({ events: [{ ...ev, replyToken: 'rt', source: { type: sourceType, userId: USER, groupId: 'C' + 'f'.repeat(32), roomId: 'R' + 'f'.repeat(32) } }] });
      const res = createRes();
      await handler(createReq({ method: 'POST', rawBody: body, headers: { 'x-line-signature': sign(body) } }), res);
      assert.equal(res.statusCode, 200);
      assert.ok(!JSON.stringify(replies).includes('t='), 'reply must not contain token');
      assert.ok(![...redis.store.keys()].some((k) => k.startsWith('authtoken:') || k.startsWith('usertoken:')), 'no token issued');
    });
  }
}

test('webhook: 上限を超える body は 413 で処理しない', async () => {
  const { handler, replies } = makeHandler();
  const big = JSON.stringify({ events: [], pad: 'x'.repeat(1024 * 1024 + 1) });
  const res = createRes();
  await handler(createReq({ method: 'POST', rawBody: big, headers: { 'x-line-signature': sign(big) } }), res);
  assert.equal(res.statusCode, 413);
  assert.equal(replies.length, 0);
});
