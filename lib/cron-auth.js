'use strict';
const { safeEqual } = require('./secure-compare');

/** Fail-closed: without a configured secret nothing is authorized. */
function isAuthorizedCron(req, secret) {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  const h = req.headers && req.headers.authorization;
  if (typeof h !== 'string') return false;
  return safeEqual(h, `Bearer ${secret}`);
}

module.exports = { isAuthorizedCron };
