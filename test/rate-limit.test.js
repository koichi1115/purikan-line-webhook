'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeRedis } = require('./helpers');
const { hitRateLimit } = require('../lib/rate-limit');

test('rate-limit: 窓の TTL は最初のカウントと同時に（SET NX EX で）付き、EXPIRE を別に呼ばない', async () => {
  const redis = createFakeRedis();
  assert.equal(await hitRateLimit(redis, 'k', 2, 60), true);
  assert.equal(redis.ttls.get('rl:k'), 60);
  assert.ok(!redis.calls.some(([c]) => c === 'EXPIRE'));
  const setCall = redis.calls.find(([c]) => c === 'SET');
  assert.deepEqual(setCall.slice(3).map(String), ['EX', '60', 'NX']);
});

test('rate-limit: 上限を超えると false、既存窓の TTL は延長しない', async () => {
  const redis = createFakeRedis();
  await hitRateLimit(redis, 'k', 2, 60);
  redis.ttls.set('rl:k', 5);
  assert.equal(await hitRateLimit(redis, 'k', 2, 60), true);
  assert.equal(redis.ttls.get('rl:k'), 5);
  assert.equal(await hitRateLimit(redis, 'k', 2, 60), false);
});
