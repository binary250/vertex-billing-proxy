# Vertex Billing — Cashfree Proxy

Same architecture as the Razorpay proxy — this small server holds your
Cashfree `client_secret` so it never has to ship inside the `.exe`.

```
Before (what we're avoiding): Electron App ──(has the secret)──> Cashfree
After:                         Electron App ──(no secret)──> This Proxy ──(has the secret)──> Cashfree
```

## What's here

- `api/create-order.js` — creates a Cashfree order and returns a
  `payment_session_id` for the app to open checkout with. The app only
  sends *which plan* it wants; price comes from `PLANS` in `lib/cashfree.js`.
- `api/order-status.js` — the app polls this to ask "has this order been
  paid?" — Cashfree's own API is the source of truth, no signature math
  needed like Razorpay required.
- `lib/cashfree.js` — the only file that ever reads `CF_CLIENT_SECRET`.

## Deploy (Vercel, free tier)

1. Push this folder to its own new GitHub repo (e.g. `vertex-billing-cashfree-proxy`).
2. Vercel → **Add New Project** → import that repo.
3. Before deploying, add Environment Variables:
   - `CF_CLIENT_ID` — Cashfree Dashboard → Developers → API Keys (Production)
   - `CF_CLIENT_SECRET` — same page
   - `PROXY_API_KEY` — any long random string you generate yourself
4. Deploy. You'll get a URL like `https://vertex-billing-cashfree-proxy.vercel.app`.
5. Your two endpoints:
   - `POST https://vertex-billing-cashfree-proxy.vercel.app/api/create-order`
   - `GET  https://vertex-billing-cashfree-proxy.vercel.app/api/order-status?orderId=...`

## Test with Cashfree's sandbox first

Cashfree gives you a separate sandbox environment with test card/UPI
credentials that never touch real money — worth using before going live,
unlike the ₹1-live-transaction approach we ended up using with Razorpay.
Set `CF_ENV=sandbox` and use your **Sandbox** API keys (a different pair
from Production, found on the same dashboard page under the Sandbox tab)
while testing. Switch both back to Production when ready for real payments.

## What changes in the Electron app

See `cashfree-payment.js` — same shape as the old `razorpay-payment.js`:
creates an order via this proxy, opens a checkout window using Cashfree's
JS SDK, polls this proxy for payment status, then generates and activates
a license locally exactly like before. License generation, trial lock,
and everything else in the app is completely untouched.
