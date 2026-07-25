/**
 * POST /api/create-order
 * Body: { planId: 'LIFETIME' | 'AMC_RENEWAL', machineId, businessName }
 * Returns: { orderId, amount, currency, keyId }
 *
 * The app never sends an amount — it only sends which plan it wants,
 * and the price comes from PLANS here on the server. That's what stops
 * someone from patching the app to request a ₹1 "Lifetime License" order.
 */

'use strict';

const { rzpRequest, requireProxyKey, readJsonBody, PLANS, RAZORPAY_KEY_ID } = require('../lib/razorpay');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireProxyKey(req, res)) return;

  const { planId, machineId, businessName } = readJsonBody(req);
  const plan = PLANS[planId];
  if (!plan) {
    res.status(400).json({ error: `Unknown plan: ${planId}` });
    return;
  }
  if (!machineId) {
    res.status(400).json({ error: 'machineId is required' });
    return;
  }

  try {
    const order = await rzpRequest('POST', '/orders', {
      amount: plan.amount,
      currency: 'INR',
      receipt: `VD_${String(machineId).slice(0, 8)}_${Date.now()}`,
      notes: {
        machine_id: machineId,
        plan: planId,
        business_name: businessName || 'Vertex Billing User',
        app: 'Vertex Billing',
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID, // public key — safe to send to the client for Checkout.js
    });
  } catch (err) {
    res.status(502).json({ error: `Could not create order: ${err.message}` });
  }
};
