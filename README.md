# Vertex Billing — Razorpay Proxy

This is the small server that now holds your Razorpay `key_secret`, so it never
has to ship inside the `.exe` again. The app talks to this instead of talking
to Razorpay directly.

```
Before:  Electron App  ──(has the secret)──>  Razorpay
After:   Electron App  ──(no secret)──>  This Proxy  ──(has the secret)──>  Razorpay
```

## What's here

- `api/create-order.js` — creates a Razorpay order. The app only sends
  *which plan* it wants (`LIFETIME` / `AMC_RENEWAL`); the price comes from the
  `PLANS` catalog in `lib/razorpay.js`, never from the client. That's what
  stops someone from patching the app to request a ₹1 order.
- `api/verify-payment.js` — recomputes the payment signature using the
  secret and tells the app `{ valid: true|false }`.
- `api/order-status.js` — the polling fallback your app already uses (in
  case the Checkout `handler()` callback doesn't fire), just routed through
  here instead of hitting Razorpay directly.
- `lib/razorpay.js` — the only file that ever reads `RAZORPAY_KEY_SECRET`.
  This folder is never bundled into the Electron app.

## Deploy (Vercel, free tier)

1. Push this folder to its own GitHub repo (e.g. `vertex-billing-proxy`) —
   keep it **separate** from your app's repo, since this one holds real secrets
   in its deploy environment.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import that repo.
3. Before the first deploy, add three **Environment Variables** in the Vercel
   project settings (Settings → Environment Variables):
   - `RAZORPAY_KEY_ID` — from Razorpay Dashboard → Settings → API Keys
   - `RAZORPAY_KEY_SECRET` — same page
   - `PROXY_API_KEY` — any long random string you generate yourself
     (e.g. run `openssl rand -hex 32` in a terminal). This is *not* a Razorpay
     value — it's just a shared password between your app and this proxy.
4. Deploy. Vercel gives you a URL like `https://vertex-billing-proxy.vercel.app`.
5. Your three endpoints are now:
   - `POST https://vertex-billing-proxy.vercel.app/api/create-order`
   - `POST https://vertex-billing-proxy.vercel.app/api/verify-payment`
   - `GET  https://vertex-billing-proxy.vercel.app/api/order-status?orderId=...`

## After deploying: rotate your Razorpay key

The current key/secret pair has already been shared in this conversation, so
generate a **new** pair in the Razorpay dashboard and use the new one here —
not the old one. Since you're still solo-testing, there's no rollout
coordination needed; just update the env vars and you're done.

## What changes in the Electron app

See `razorpay-payment.CHANGES.md` (or the annotated version of
`razorpay-payment.js`) for the exact before/after — in short:
`RAZORPAY_KEY_SECRET` is deleted from the app entirely, and the three places
that used to call Razorpay directly now call this proxy's three endpoints
instead. Everything else — the checkout window, the pre-fill, the license
generation, the trial lock — is untouched.
