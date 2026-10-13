'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createReq, createRes, createFakeRedis } = require('./helpers');
const { createHandler } = require('../api/reminder');
const { issueUserToken } = require('../lib/user-auth');

const USER = 'U' + 'a'.repeat(32);
const OTHER = 'U' + 'b'.repeat(32);

function futureDate(days) {
  const d = new Date(Date.now() + 9 * 3600e3 + days * 86400e3);
  return d.toISOString().slice(0, 10);
}

function validBody(extra = {}) {
  return { title: '体操服', dueDate: futureDate(5), targetPerson: '長男', type: 'item', daysBefore: 1, ...extra };
}

async function setup() {
  const redis = createFakeRedis();
  const token = await issueUserToken(redis, USER);
  const handler = createHandler({ redis });
  return { redis, token, handler };
}

async function post(handler, { token, body, ip = '203.0.113.1' }) {
  const headers = { 'x-forwarded-for': ip };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = createRes();
  await handler(createReq({ method: 'POST', headers, body }), res);
  return res;
}

test('reminder: GET は 405（一覧取得ルートを削除）', async () => {
  const { handler } = await setup();
  const res = createRes();
  await handler(createReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

test('reminder: DELETE は 405（任意キー削除ルートを削除）', async () => {
  const { handler, redis } = await setup();
  redis.store.set('reminder:2026-10-14:1', '{}');
  const res = createRes();
  await handler(createReq({ method: 'DELETE', body: { key: 'reminder:2026-10-14:1' } }), res);
  assert.equal(res.statusCode, 405);
  assert.ok(redis.store.has('reminder:2026-10-14:1'));
});

test('reminder: POST はトークンなしで 401', async () => {
  const { handler } = await setup();
  const res = await post(handler, { body: validBody({ lineUserId: USER }) });
  assert.equal(res.statusCode, 401);
});

test('reminder: POST は不正トークンで 401', async () => {
  const { handler } = await setup();
  const res = await post(handler, { token: 'x'.repeat(43), body: validBody() });
  assert.equal(res.statusCode, 401);
});

test('reminder: POST 正常系はトークン由来の userId で保存し本文の lineUserId を無視', async () => {
  const { handler, token, redis } = await setup();
  const res = await post(handler, { token, body: validBody({ lineUserId: OTHER }) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  const saved = JSON.parse(redis.store.get(res.body.key));
  assert.equal(saved.lineUserId, USER);
  assert.equal(saved.title, '体操服');
});

test('reminder: POST 入力検証（必須欠落・型・長さ・日付・type・daysBefore・driveFileId）で 400', async () => {
  const { handler, token } = await setup();
  const bad = [
    { title: undefined },
    { title: 123 },
    { title: 'a'.repeat(201) },
    { dueDate: '2026-13-40' },
    { dueDate: 'tomorrow' },
    { dueDate: futureDate(400) },
    { dueDate: futureDate(-10) },
    { type: 'spam' },
    { daysBefore: 99 },
    { daysBefore: 1.5 },
    { targetPerson: 'x'.repeat(51) },
    { documentTitle: 'x'.repeat(201) },
    { driveFileId: '../../etc' },
  ];
  for (const patch of bad) {
    const res = await post(handler, { token, body: validBody(patch) });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
  }
});

test('reminder: POST 本文がオブジェクトでなければ 400', async () => {
  const { handler, token } = await setup();
  const res = await post(handler, { token, body: 'nope' });
  assert.equal(res.statusCode, 400);
});

test('reminder: POST ユーザー単位のレート制限で 429', async () => {
  const { handler, token } = await setup();
  let last;
  for (let i = 0; i < 101; i++) {
    last = await post(handler, { token, body: validBody(), ip: `198.51.100.${i % 250}` });
  }
  assert.equal(last.statusCode, 429);
});

test('reminder: POST IP 単位のレート制限で 429（未認証でも数える）', async () => {
  const { handler } = await setup();
  let last;
  for (let i = 0; i < 31; i++) last = await post(handler, { body: validBody() });
  assert.equal(last.statusCode, 429);
});

test('reminder: 500 応答に内部エラー文を含めない', async () => {
  const redis = { command: async () => { throw new Error('secret-internal-detail'); } };
  const handler = createHandler({ redis });
  const res = await post(handler, { token: 'y'.repeat(43), body: validBody() });
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res.body).includes('secret-internal-detail'));
});
