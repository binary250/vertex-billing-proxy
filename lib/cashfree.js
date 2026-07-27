/**
 * lib/cashfree.js
 * ─────────────────────────────────────────────────────────────
 * The ONLY place CF_CLIENT_SECRET is ever read. This file never ships
 * inside the Electron app — it lives only on the server (Vercel), where
 * the secret is set as an environment variable.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const https = require('https');

const CF_CLIENT_ID     = process.env.CF_CLIENT_ID;
const CF_CLIENT_SECRET = process.env.CF_CLIENT_SECRET;
const CF_API_VERSION   = '2023-08-01'; // stable, widely-supported version
const CF_HOSTNAME      = process.env.CF_ENV === 'sandbox' ? 'sandbox.cashfree.com' : 'api.cashfree.com';

// Same catalog as the app — kept here so a client can only ever buy
// what you've defined, never an amount it makes up itself.
const PLANS = {
  LIFETIME: {
    amount: 4999, // rupees (Cashfree takes a plain decimal amount, not paise)
    label: 'Lifetime License',
    licenseType: 'LIFETIME',
  },
  AMC_RENEWAL: {
    amount: 1499,
    label: 'AMC Renewal – 1 Year',
    licenseType: 'AMC_RENEWAL',
  },
};

/** Raw HTTPS call to Cashfree's PG API — no SDK needed */
function cfRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    if (!CF_CLIENT_ID || !CF_CLIENT_SECRET) {
      reject(new Error('Server is missing CF_CLIENT_ID / CF_CLIENT_SECRET env vars'));
      return;
    }
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request(
      {
        hostname: CF_HOSTNAME,
        path: `/pg${endpoint}`,
        method,
        timeout: 10000,
        headers: {
          'x-client-id':     CF_CLIENT_ID,
          'x-client-secret': CF_CLIENT_SECRET,
          'x-api-version':   CF_API_VERSION,
          'Content-Type':    'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) reject(new Error(json.message || `HTTP ${res.statusCode}`));
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

/** Rejects requests that don't carry the shared app→proxy key — same purpose as
 *  the Razorpay proxy's guard: keeps randoms on the internet from spamming
 *  your proxy / Cashfree account. Not a Cashfree credential itself. */
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
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch (_) {
    return {};
  }
}

module.exports = { cfRequest, requireProxyKey, readJsonBody, PLANS };
