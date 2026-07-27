/**
 * POST /api/create-order
 * Body: { planId: 'LIFETIME' | 'AMC_RENEWAL', machineId, businessName, phone, email }
 * Returns: { orderId, paymentSessionId }
 *
 * The app never sends an amount — only which plan it wants. The price
 * comes from PLANS here on the server, same protection as the Razorpay
 * version: stops a patched app from requesting a ₹1 "Lifetime" order.
 */

'use strict';

const { cfRequest, requireProxyKey, readJsonBody, PLANS } = require('../lib/cashfree');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireProxyKey(req, res)) return;

  const { planId, machineId, businessName, phone, email } = readJsonBody(req);
  const plan = PLANS[planId];
  if (!plan) {
    res.status(400).json({ error: `Unknown plan: ${planId}` });
    return;
  }
  if (!machineId) {
    res.status(400).json({ error: 'machineId is required' });
    return;
  }

  // Cashfree requires a customer_id and customer_phone on every order.
  // machineId doubles as a stable customer_id since we don't run user accounts.
  const orderId = `VB_${String(machineId).slice(0, 10)}_${Date.now()}`;

  try {
    const order = await cfRequest('POST', '/orders', {
      order_id: orderId,
      order_amount: plan.amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: String(machineId).slice(0, 40),
        customer_phone: phone || '9999999999', // Cashfree requires a phone; placeholder if app doesn't collect one
        customer_email: email || undefined,
        customer_name: businessName || 'Vertex Billing User',
      },
      order_meta: {
        // return_url just needs to exist — the app doesn't navigate a real browser here;
        // the desktop app watches for navigation to this URL pattern and reads order_id off it.
        return_url: 'https://vertex-billing-proxy.vercel.app/api/return?order_id={order_id}',
      },
      order_note: `${plan.label} | plan=${planId} | machine=${machineId}`,
    });

    res.status(200).json({
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
    });
  } catch (err) {
    res.status(502).json({ error: `Could not create order: ${err.message}` });
  }
};
