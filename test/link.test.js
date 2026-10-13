'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createReq, createRes } = require('./helpers');
const handler = require('../api/link');

const USER = 'U' + 'e'.repeat(32);
const TOKEN = 'A'.repeat(43);

function call(query) {
  const res = createRes();
  handler(createReq({ query }), res);
  return res;
}

test('link: XSS ペイロードの id は 400 で反射しない', () => {
  for (const id of ['"></a><script>alert(1)</script>', '";alert(1);//', 'javascript:alert(1)', USER + '"']) {
    const res = call({ id });
    assert.equal(res.statusCode, 400, id);
    assert.ok(!String(res.body).includes('<script>alert'), id);
    assert.ok(!String(res.body).includes(id), id);
  }
});

test('link: 不正な t も 400', () => {
  const res = call({ id: USER, t: '"><img src=x onerror=alert(1)>' });
  assert.equal(res.statusCode, 400);
});

test('link: 正しい id と t で deep link を返す', () => {
  const res = call({ id: USER, t: TOKEN });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes(`otayori-ai://link-line?id=${USER}&amp;token=${TOKEN}`));
  assert.ok(res.body.includes(JSON.stringify(`otayori-ai://link-line?id=${USER}&token=${TOKEN}`)));
});

test('link: id のみ（旧リンク互換）も形式が正しければ 200', () => {
  const res = call({ id: USER });
  assert.equal(res.statusCode, 200);
  assert.ok(!res.body.includes('token='));
});

test('link: 配列などの非文字列 id は 400', () => {
  assert.equal(call({ id: [USER, USER] }).statusCode, 400);
  assert.equal(call({}).statusCode, 400);
});
