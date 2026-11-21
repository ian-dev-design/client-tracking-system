# Deploying to Netlify (free)

Only do this when the owner says to deploy. Everything here stays on Netlify's free **Starter** plan.
**If any screen asks for a credit card, a paid plan, or says "Upgrade", stop and don't continue.**

What's already in the repo:
- `netlify.toml`: build command, Node 22, and where the scheduled function lives. Netlify adds its Next.js runtime on its own.
- `netlify/functions/daily.mts`: a Netlify Scheduled Function that runs daily at 15:00 UTC and calls `/api/cron/daily` with `CRON_SECRET`. That sends newly-urgent task emails and the weekly digest.

---

## 1. Environment variables (names only; values come from your `.env.local`)

Set these in Netlify, never in git:

| Name | Notes |
|---|---|
| `DATA_BACKEND` | must be `sheets` |
| `NEXTAUTH_URL` | your Netlify URL, e.g. `https://your-site.netlify.app` (no trailing slash) |
| `NEXTAUTH_SECRET` | same as local is fine |
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | |
| `ALLOWED_EMAILS` | the team |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole key on one line |
| `EMAIL_TEST_REDIRECT` | keep it while testing; remove it later to email real people |
| `CRON_SECRET` | new: any long random string (`openssl rand -base64 32`) |
| `NOTIFY_SENDER_EMAIL` | the account that sends the digest |
| `NOTIFY_SENDER_REFRESH_TOKEN` | from Settings → Notifications → Scheduled sender |
| `SURVEY_SYNC_SECRET` | optional: only if you install the Form ping (`apps-script/form-sync.gs`) |
| `OWNER_NAME` | optional |

**Don't add:** `DEMO_USER_NAME`, `DEMO_USER_EMAIL` (demo mode never runs on the live site), or `ANTHROPIC_API_KEY` (a paid API).
Keep the total small: Netlify functions allow about 4 KB of environment variables in all, and the list above is about 3 KB.

---

## 2. Connect Netlify to the private GitHub repo

1. Go to **app.netlify.com** and sign up / log in **with GitHub**. Choose the free plan. Skip any trial offers.
2. Click **Add new project** (older screens say "Add new site") → **Import an existing project**.
3. Click **GitHub**. A GitHub window opens: **Authorize Netlify**.
4. If the repo isn't listed, click **Configure the Netlify app on GitHub**. Under *Repository access*, choose **Only select repositories** → pick **client-tracking-system** → **Save**.
   - The repo is under your personal account, so the free plan works. (Netlify asks for a paid plan for private repos owned by a GitHub *organization*. If you ever see that, stop.)
5. Back in Netlify, click **client-tracking-system**.
6. On *Configure*, check:
   - Branch to deploy: **main**
   - Build command: `npm run build`, publish directory `.next` (filled in from `netlify.toml`; leave them)
   - Project name: pick one now, e.g. `goatops-crm`. That makes the URL `https://goatops-crm.netlify.app`.

## 3. Set the environment variables

Still on the *Configure* page, click **Add environment variables** (or do it after: **Project configuration → Environment variables**):

1. Click **Add a variable → Add a single variable** (or **Import from a .env file** and paste only the lines from the table above).
2. For each name in the table: enter the key, paste the value, leave scopes on **All scopes** (the scheduled function needs the *Functions* scope) and the same value for all deploy contexts.
3. Set `NEXTAUTH_URL` to `https://<your project name>.netlify.app`.

## 4. Deploy

1. Click **Deploy <project name>**. The build takes a few minutes. Watch it under **Deploys**.
2. When it says **Published**, note the URL at the top of the project page.
3. If the URL is different from what you put in `NEXTAUTH_URL`, fix the variable (step 3), then **Deploys → Trigger deploy → Deploy project**. Every env variable change needs a new deploy.

## 5. Add the Netlify URL to Google sign-in

1. Go to **console.cloud.google.com**. Pick the project used for the CRM (top bar).
2. **APIs & Services → Credentials**. Under *OAuth 2.0 Client IDs*, click your web client.
3. **Authorized JavaScript origins → Add URI**: `https://<your project name>.netlify.app`
4. **Authorized redirect URIs → Add URI**: `https://<your project name>.netlify.app/api/auth/callback/google`
5. Keep the `localhost:3000` entries so local still works. Click **Save**. Google can take a few minutes to apply it.
6. Open the Netlify URL and sign in. "redirect_uri_mismatch" means step 4 or `NEXTAUTH_URL` doesn't exactly match the URL (https, no trailing slash).

## 6. Check the daily job

1. In Netlify: **Logs → Functions → daily**. It should show the schedule.
2. Click **Run now**. The log should say `Daily job: 200 {"ok":true,...}`. A `401` means `CRON_SECRET` is missing or the site wasn't redeployed after adding it.
3. With `EMAIL_TEST_REDIRECT` still set, any digest goes only to that address.

## Later

- Instant survey sync: install `apps-script/form-sync.gs` on the Form with your Netlify URL and `SURVEY_SYNC_SECRET`.
- Adding a teammate: edit `ALLOWED_EMAILS` in Netlify, then **Trigger deploy**.
- Pushing to `main` in GitHub Desktop redeploys automatically. To stop that, use **Project configuration → Build & deploy → Stop builds**.
