/**
 * lib/razorpay.js
 * ─────────────────────────────────────────────────────────────
 * The ONLY place RAZORPAY_KEY_SECRET is ever read. This file never
 * ships inside the Electron app — it lives only on the server
 * (Vercel), where the secret is set as an environment variable and
 * never appears in any file you commit or distribute.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const https = require('https');
const crypto = require('crypto');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Same catalog as the app — kept here so a client can only ever buy
// what you've defined, never an amount it makes up itself.
const PLANS = {
  LIFETIME: {
    amount: 100, // paise (₹4,999 × 100)
    label: 'Lifetime License',
    licenseType: 'LIFETIME',
  },
  AMC_RENEWAL: {
    amount: 149900, // paise (₹1,499 × 100)
    label: 'AMC Renewal – 1 Year',
    licenseType: 'AMC_RENEWAL',
  },
};

/** Raw HTTPS call to Razorpay API — no SDK needed */
function rzpRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      reject(new Error('Server is missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars'));
      return;
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path: `/v1${endpoint}`,
        method,
        timeout: 10000,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) reject(new Error(json.error?.description || `HTTP ${res.statusCode}`));
            else resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

/** Recomputes the Razorpay checkout signature server-side — the secret never has to leave this file */
function verifySignature(orderId, paymentId, signature) {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch (_) {
    return false; // length mismatch etc. — treat as invalid, never throw
  }
}

/** Rejects requests that don't carry the shared app→proxy key. Not a secret Razorpay ever sees —
 *  just keeps randoms on the internet from spamming your proxy / Razorpay account. */
function requireProxyKey(req, res) {
  const expected = process.env.PROXY_API_KEY;
  const got = req.headers['x-proxy-key'];
  if (!expected || got !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function readJsonBody(req) {
  // Vercel already parses JSON bodies into req.body for you, but guard just in case.
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch (_) {
    return {};
  }
}

module.exports = { rzpRequest, verifySignature, requireProxyKey, readJsonBody, PLANS, RAZORPAY_KEY_ID };
