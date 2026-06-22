/**
 * Redirect endpoint: /api/link?id=<LINE_USER_ID>
 * Opens in browser, then redirects to app deep link
 */
module.exports = function handler(req, res) {
  const id = req.query.id;
  if (!id) {
    return res.status(400).send('Missing id');
  }

  const deepLink = `otayori-ai://link-line?id=${id}`;

  // Return an HTML page that redirects to the app deep link
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
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
    <a class="btn" href="${deepLink}">アプリを開いて連携する</a>
  </div>
  <script>
    // Auto-redirect after short delay
    setTimeout(function() { window.location.href = "${deepLink}"; }, 500);
  </script>
</body>
</html>`);
};
