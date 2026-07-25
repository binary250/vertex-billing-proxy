/**
 * POST /api/verify-payment
 * Body: { orderId, paymentId, signature }
 * Returns: { valid: true|false }
 *
 * Recomputes the HMAC using the secret held only on this server, so the
 * app never needs RAZORPAY_KEY_SECRET to check whether a payment is genuine.
 */

'use strict';

const { verifySignature, requireProxyKey, readJsonBody } = require('../lib/razorpay');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireProxyKey(req, res)) return;

  const { orderId, paymentId, signature } = readJsonBody(req);
  if (!orderId || !paymentId) {
    res.status(400).json({ error: 'orderId and paymentId are required' });
    return;
  }

  const valid = verifySignature(orderId, paymentId, signature);
  res.status(200).json({ valid });
};
