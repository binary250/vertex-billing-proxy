/**
 * GET /api/return?order_id=...
 * Not meant to be seen in normal use — the app intercepts navigation to
 * this URL before it loads. This exists only so nothing 404s if that
 * interception ever races and the page briefly loads first.
 */

'use strict';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html><body style="font-family:sans-serif;text-align:center;padding-top:80px;">
      <h2>Payment complete</h2>
      <p>You can close this window and return to Vertex Billing.</p>
    </body></html>
  `);
};
