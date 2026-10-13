'use strict';
const { isLineUserId, isUserToken } = require('./ids');

const BASE_URL = 'https://purikan-line-webhook.vercel.app';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** For use inside <script>: JSON string with < escaped so "</script>" cannot break out. */
function jsString(s) {
  return JSON.stringify(String(s)).replace(/</g, '\\u003c');
}

function buildLinkUrl(userId, token) {
  const q = new URLSearchParams({ id: userId });
  if (token) q.set('t', token);
  return `${BASE_URL}/api/link?${q}`;
}

function buildDeepLink(userId, token) {
  if (!isLineUserId(userId) || (token !== undefined && !isUserToken(token))) return null;
  return `otayori-ai://link-line?id=${userId}${token ? `&token=${token}` : ''}`;
}

function renderLinkPage(deepLink) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>ぷりかん！LINE連携</title>
  <style>
    body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; background: #f5f5f5; }
    .card { background: white; border-radius: 16px; padding: 32px; max-width: 360px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; margin-bottom: 24px; }
    .btn { display: inline-block; background: #4A90D9; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>ぷりかん！LINE連携</h1>
    <p>ボタンをタップしてアプリを開きます</p>
    <a class="btn" href="${escapeHtml(deepLink)}">アプリを開いて連携する</a>
  </div>
  <script>
    // Auto-redirect after short delay
    setTimeout(function() { window.location.href = ${jsString(deepLink)}; }, 500);
  </script>
</body>
</html>`;
}

module.exports = { escapeHtml, jsString, buildLinkUrl, buildDeepLink, renderLinkPage };
