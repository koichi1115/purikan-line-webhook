'use strict';

const LINE_USER_ID_RE = /^U[0-9a-f]{32}$/;
const USER_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const isLineUserId = (v) => typeof v === 'string' && LINE_USER_ID_RE.test(v);
const isUserToken = (v) => typeof v === 'string' && USER_TOKEN_RE.test(v);

module.exports = { isLineUserId, isUserToken };
