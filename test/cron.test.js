'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createReq, createRes, createFakeRedis } = require('./helpers');
const { createHandler } = require('../api/cron/send-reminders');
const { isAuthorizedCron } = require('../lib/cron-auth');

const SECRET = 'test-cron-secret-value';

function makeHandler({ secret = SECRET, redis = createFakeRedis(), pushes = [] } = {}) {
  const sendPush = async (to, text) => { pushes.push({ to, text }); return true; };
  return { handler: createHandler({ redis, sendPush, getSecret: () => secret }), redis, pushes };
}

test('cron: Authorization なしは 401 で何も実行しない', async () => {
  const { handler, redis } = makeHandler();
  const res = createRes();
  await handler(createReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(redis.calls.length, 0);
});

test('cron: Bearer 不一致は 401', async () => {
  const { handler } = makeHandler();
  const res = createRes();
  await handler(createReq({ headers: { authorization: 'Bearer wrong' } }), res);
  assert.equal(res.statusCode, 401);
});

test('cron: CRON_SECRET 未設定なら正しそうなヘッダでも拒否（fail-closed）', async () => {
  for (const secret of [undefined, '']) {
    const { handler, redis } = makeHandler({ secret });
    const res = createRes();
    await handler(createReq({ headers: { authorization: 'Bearer ' } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(redis.calls.length, 0);
  }
});

test('cron: 正しい Bearer で送信し、ログ/応答に userId を出さない', async () => {
  const redis = createFakeRedis();
  const user = 'U' + 'c'.repeat(32);
  redis.store.set('reminder:2000-01-01:1', JSON.stringify({ lineUserId: user, title: 't', dueDate: '2000-01-02', targetPerson: 'p', type: 'todo' }));
  const { handler, pushes } = makeHandler({ redis });
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  const res = createRes();
  try {
    await handler(createReq({ headers: { authorization: `Bearer ${SECRET}` } }), res);
  } finally { console.log = orig; }
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sent, 1);
  assert.equal(pushes[0].to, user);
  assert.ok(!logs.join('\n').includes(user));
  assert.ok(!JSON.stringify(res.body).includes(user));
});

test('isAuthorizedCron: 長さ違い・スキーム違いも false', () => {
  assert.equal(isAuthorizedCron({ headers: { authorization: `Bearer ${SECRET}x` } }, SECRET), false);
  assert.equal(isAuthorizedCron({ headers: { authorization: `Basic ${SECRET}` } }, SECRET), false);
  assert.equal(isAuthorizedCron({ headers: { authorization: `Bearer ${SECRET}` } }, SECRET), true);
});
