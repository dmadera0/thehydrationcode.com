'use strict';

/**
 * The Hydration Code — forms Lambda.
 *
 * Handles both the homepage newsletter signup and the /contact page. Both
 * POST { email, type, message? } as JSON to the same function; type picks
 * which one this submission is. Every valid, non-honeypot submission becomes
 * one row in the shared Google Sheet: [email, type, ISO timestamp, message].
 *
 * See README.md for deployment (Lambda console + API Gateway HTTP API) and
 * the exact environment variables this needs.
 */

const { google } = require('googleapis');

const ALLOWED_TYPES = new Set(['newsletter', 'contact']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The honeypot field name matches the one already built into
// NewsletterForm.astro (`company`) — a real visitor never sees or fills
// this field, so any submission that includes it is almost certainly a bot.
// Matched submissions return a normal-looking success without writing a row.
const HONEYPOT_FIELD = 'company';

const ALLOWED_ORIGINS = [
  'https://thehydrationcode.com',
  'https://www.thehydrationcode.com',
];
// Amplify URLs look like https://<app-id>.amplifyapp.com (default domain) or
// https://<branch>.<app-id>.amplifyapp.com (branch/PR previews) — one or more
// dot-separated labels ahead of the fixed amplifyapp.com suffix.
const AMPLIFY_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)+amplifyapp\.com$/i;

function isAllowedOrigin(origin) {
  return !!origin && (ALLOWED_ORIGINS.includes(origin) || AMPLIFY_ORIGIN_RE.test(origin));
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function respond(statusCode, origin, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
    body: JSON.stringify(body),
  };
}

/**
 * Best-effort, per-warm-container rate limit. Lambda gives no shared state
 * across concurrent/cold containers, so this is not a real distributed rate
 * limiter — it only catches a burst hitting the same warm instance. The
 * honeypot check above is the actual anti-bot mechanism; this is a cheap
 * extra layer, not a substitute. For real protection, put a WAF rule or an
 * API Gateway usage plan in front of this instead.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const recentRequestsByIp = new Map();

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const timestamps = (recentRequestsByIp.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  recentRequestsByIp.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function getSourceIp(event) {
  return event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp || '';
}

function getHttpMethod(event) {
  return event.requestContext?.http?.method || event.httpMethod || 'POST';
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(raw);
}

function validate(payload) {
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const type = payload.type;
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (!email || !EMAIL_RE.test(email)) {
    return { error: 'A valid email address is required.' };
  }
  if (!ALLOWED_TYPES.has(type)) {
    return { error: 'type must be either "newsletter" or "contact".' };
  }
  if (type === 'contact' && !message) {
    return { error: 'message is required for contact submissions.' };
  }
  return { email, type, message };
}

let sheetsClientPromise = null;

function getSheetsClient() {
  if (!sheetsClientPromise) {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      undefined,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: 'v4', auth }));
  }
  return sheetsClientPromise;
}

async function appendRow({ email, type, message }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Sheet1!A:D',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[email, type, new Date().toISOString(), message || '']],
    },
  });
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const method = getHttpMethod(event);

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (method !== 'POST') {
    return respond(405, origin, { ok: false, error: 'Method not allowed.' });
  }

  // Checked before body parsing/validation so repeated garbage requests
  // from the same warm container get throttled too, not just valid ones.
  if (isRateLimited(getSourceIp(event))) {
    return respond(429, origin, { ok: false, error: 'Too many requests. Try again in a minute.' });
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return respond(400, origin, { ok: false, error: 'Malformed JSON body.' });
  }

  // Silently succeed on a filled honeypot — looks the same as a real
  // submission to whatever filled it in, but nothing gets written.
  if (typeof payload[HONEYPOT_FIELD] === 'string' && payload[HONEYPOT_FIELD].trim() !== '') {
    return respond(200, origin, { ok: true });
  }

  const validated = validate(payload);
  if (validated.error) {
    return respond(400, origin, { ok: false, error: validated.error });
  }

  try {
    await appendRow(validated);
  } catch (err) {
    console.error('Failed to append row to Google Sheet:', err);
    return respond(500, origin, { ok: false, error: 'Something went wrong. Try again shortly.' });
  }

  return respond(200, origin, { ok: true });
};
