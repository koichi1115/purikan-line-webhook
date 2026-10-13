/**
 * Redirect endpoint: /api/link?id=<LINE_USER_ID>&t=<USER_TOKEN>
 * Opens in browser, then redirects to app deep link.
 * id / t are strictly validated (reflected XSS fix); t is optional for old links.
 */
const { buildDeepLink, renderLinkPage } = require('../lib/link-page');

module.exports = function handler(req, res) {
  const { id, t } = req.query || {};
  const deepLink = buildDeepLink(id, t === undefined || t === '' ? undefined : t);
  if (!deepLink) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(400).send('Invalid link');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  return res.status(200).send(renderLinkPage(deepLink));
};
