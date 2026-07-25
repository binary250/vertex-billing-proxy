/**
 * GET /api/order-status?orderId=order_xxx
 * Returns: { status: 'paid' | 'failed' | 'pending', paymentId?, signature?, email?, error? }
 *
 * Used as the slow-path fallback the app already relies on (polling every
 * ~3s) in case the Checkout `handler()` callback doesn't fire reliably
 * inside the Electron webview. Same behavior as before, just routed
 * through here instead of hitting Razorpay directly with the secret.
 */

'use strict';

const { rzpRequest, requireProxyKey } = require('../lib/razorpay');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireProxyKey(req, res)) return;

  const orderId = req.query?.orderId;
  if (!orderId) {
    res.status(400).json({ error: 'orderId is required' });
    return;
  }

  try {
    const orderData = await rzpRequest('GET', `/orders/${orderId}/payments`);
    const paid = orderData.items?.find((p) => p.status === 'captured' || p.status === 'authorized');
    const failed = orderData.items?.find((p) => p.status === 'failed');

    if (paid) {
      const signature = require('crypto')
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paid.id}`)
        .digest('hex');
      res.status(200).json({
        status: 'paid',
        paymentId: paid.id,
        signature, // pre-computed so the app's existing "done()" shape needs no changes
        email: paid.email || '',
      });
      return;
    }
    if (failed) {
      res.status(200).json({ status: 'failed', error: failed.error_description || 'Payment failed' });
      return;
    }
    res.status(200).json({ status: 'pending' });
  } catch (err) {
    res.status(502).json({ status: 'pending', error: err.message });
  }
};
