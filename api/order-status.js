/**
 * GET /api/order-status?orderId=VB_xxx
 * Returns: { status: 'paid' | 'failed' | 'pending', email? }
 *
 * Cashfree doesn't need a signature-verification step like Razorpay —
 * asking "is this order paid?" directly against their authenticated API
 * is itself the source of truth. Simpler than the Razorpay proxy in
 * that specific way.
 */

'use strict';

const { cfRequest, requireProxyKey } = require('../lib/cashfree');

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
    const order = await cfRequest('GET', `/orders/${encodeURIComponent(orderId)}`);
    // order_status: ACTIVE (created, awaiting payment) | PAID | EXPIRED | TERMINATED
    if (order.order_status === 'PAID') {
      res.status(200).json({ status: 'paid', email: order.customer_details?.customer_email || '' });
      return;
    }
    if (order.order_status === 'EXPIRED' || order.order_status === 'TERMINATED') {
      res.status(200).json({ status: 'failed', error: `Order ${order.order_status.toLowerCase()}` });
      return;
    }
    res.status(200).json({ status: 'pending' });
  } catch (err) {
    res.status(502).json({ status: 'pending', error: err.message });
  }
};
