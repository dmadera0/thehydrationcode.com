# forms-lambda

AWS Lambda function backing the two forms on The Hydration Code:

- The homepage newsletter signup (`NewsletterForm.astro`)
- The `/contact` page

Both POST JSON to this same function — `{ email, type, message? }`, where
`type` is `"newsletter"` or `"contact"` (message is only required for
`"contact"`) — and it appends one row per valid submission to a shared
Google Sheet: `[email, type, ISO timestamp, message-or-blank]`.

There's no framework, bundler, or build step. It's one file
(`index.js`) plus the `googleapis` dependency, deployed as a plain zip.
That's deliberate — this is one small function, not a service.

## What it checks before writing a row

- `email` looks like an email address, `type` is one of the two allowed
  values, and `message` is present for `type: "contact"`. Anything else gets
  a `400` with a specific error message.
- **Honeypot**: a `company` field (same hidden field already built into
  `NewsletterForm.astro`) that a real visitor never sees or fills in. If it
  arrives non-empty, the function returns a normal-looking `200 { ok: true }`
  without writing anything — the bot thinks it worked.
- **Best-effort rate limit**: max 5 requests per 60 seconds per source IP,
  tracked in memory. This only holds within one warm Lambda container — it
  is not a distributed rate limiter and resets on a cold start. It's a cheap
  extra layer, not the real defense; the honeypot is. If you need actual
  abuse protection later, put an API Gateway usage plan or a WAF rule in
  front of this instead of trying to make this in-memory counter smarter.
- **CORS**: only allows `https://thehydrationcode.com`,
  `https://www.thehydrationcode.com`, and any `https://*.amplifyapp.com`
  origin (covers Amplify's default domain and branch/PR preview URLs). Any
  other origin gets a response with no `Access-Control-Allow-Origin` header,
  which the browser will refuse to expose to the calling page.

## Environment variables

Set these in the Lambda console under **Configuration → Environment
variables**. Nothing else is required.

| Variable | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | The `client_email` field in the Google Cloud service account's JSON key |
| `GOOGLE_PRIVATE_KEY` | The `private_key` field from the same JSON key. Paste it exactly as it appears in the JSON, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines — the Lambda console's environment variable textarea accepts real newlines, and the code also un-escapes literal `\n` if your tooling flattens it to one line. |
| `GOOGLE_SHEET_ID` | The long ID in the sheet's URL: `https://docs.google.com/spreadsheets/d/THIS_PART/edit` |

**Do not commit the service account JSON anywhere in this repo.** If you
download it for local testing, it'll land outside git automatically (see
`.gitignore` in this folder), but double-check before you `git add`.

### One-time Google Cloud setup

1. Create (or reuse) a Google Cloud project → **APIs & Services → Enabled
   APIs** → enable the **Google Sheets API**.
2. **IAM & Admin → Service Accounts → Create service account.** No roles
   needed at the project level — access is granted per-sheet in the next
   step.
3. On the new service account: **Keys → Add key → Create new key → JSON**.
   Download it. This file has the three values above.
4. Open the target Google Sheet → **Share** → add the service account's
   `client_email` as an **Editor**. Without this step the function
   authenticates fine but every write fails with a permissions error.
5. Make sure row 1 of the sheet has headers (e.g. `Email | Type | Timestamp
   | Message`) so appended rows land in a sensible place — the function
   always appends to `Sheet1!A:D` on whatever the first sheet tab is named
   `Sheet1`. If your tab has a different name, change the `range` in
   `index.js`'s `appendRow()` to match before deploying.

## Deploy (v1: manual zip upload — no CDK/Terraform for one function)

1. Install dependencies and zip the function with its `node_modules`:

   ```sh
   cd infra/forms-lambda
   npm install
   zip -r function.zip index.js node_modules package.json
   ```

2. AWS Console → **Lambda → Create function**
   - Author from scratch
   - Runtime: **Node.js 20.x**
   - Architecture: arm64 (cheaper) or x86_64 — either works, nothing here is
     architecture-specific
3. On the function page → **Code → Upload from → .zip file** → upload
   `function.zip`.
4. Handler should be `index.handler` (the default for a file named
   `index.js` exporting `handler` — confirm under **Runtime settings**).
5. **Configuration → Environment variables** → add the three variables
   above.
6. **Configuration → General configuration** → timeout: 10 seconds is
   plenty (Sheets API calls are fast); memory: 128 MB is enough.

Re-deploying after a code change: repeat step 1's zip, then **Code → Upload
from → .zip file** again with the new `function.zip`.

## Expose it publicly: API Gateway HTTP API

1. **API Gateway console → Create API → HTTP API → Build**.
2. **Add integration** → Lambda → select this function.
3. Route: `POST /submit` (or any path — whatever you use here is the path
   segment on the final URL).
4. Skip auto-deploy stage config changes — the default `$default` stage
   auto-deploys, which is fine for this.
5. **CORS**: on the API's **CORS** settings, you can leave this unconfigured
   and let the Lambda's own CORS headers do the work (what `index.js`
   already returns), or configure it here too as a second line of defense —
   if you do, set Allow Origins to the same two domains listed above, Allow
   Methods to `POST, OPTIONS`, Allow Headers to `Content-Type`. Don't rely on
   API Gateway CORS *instead of* the Lambda's own handling — the Lambda
   needs to see and handle `OPTIONS` itself either way if you route `ANY` or
   `OPTIONS` through it, which the steps above already do by routing the
   method the browser sends.
6. After creation, the **Invoke URL** shown on the API's dashboard
   (something like `https://abc123xyz.execute-api.us-east-1.amazonaws.com`)
   plus your route path (`/submit`) is the full endpoint URL.

That full URL — e.g.
`https://abc123xyz.execute-api.us-east-1.amazonaws.com/submit` — is what
goes into `PUBLIC_NEWSLETTER_ENDPOINT` (see the repo root `.env.example`).
Both the newsletter form and the contact form use this one endpoint; the
Lambda tells them apart by the `type` field in the request body.

## Testing without deploying

`index.js` exports `handler` and has no AWS SDK dependency at the top level
beyond `googleapis`, so it can be invoked directly with Node for a quick
logic check (validation, honeypot, CORS, rate limiting) by mocking the event
shape — see the project's test notes if you need an example. Testing the
actual Google Sheets write requires real (or locally-scoped test) service
account credentials in your shell environment; never put them in a file
inside this repo.
