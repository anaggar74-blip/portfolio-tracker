# One-time Google Calendar setup (for the "Sync Calendar" button)

Do this once. It lets the app write earnings + macro events into a Google Calendar
named **"Stocks"**, with a reminder 2 days before each event. ~10 minutes.

You will end up with **3 values** to paste into Vercel:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.

---

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com/
2. Top bar → project dropdown → **New Project** → name it `Portfolio Calendar` → **Create**.
3. Make sure that new project is selected (top bar).

## 2. Enable the Calendar API
1. Search bar → "Google Calendar API" → open it → **Enable**.

## 3. Configure the consent screen (and PUBLISH it)
1. Left menu → **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create.
3. App name: `Portfolio Calendar`. User support email: your email. Developer email: your email. Save/Continue.
4. Scopes: skip (Save/Continue).
5. Test users: add your own Gmail. Save/Continue.
6. **Back on the OAuth consent screen, click "PUBLISH APP" → Confirm.**
   ⚠ This step matters: if left in "Testing", the login token dies after 7 days and
   the monthly auto-sync breaks. Publishing (you'll click through a one-time
   "unverified app" warning later) keeps it working. No Google review is needed for personal use.

## 4. Create an OAuth client
1. Left menu → **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Under **Authorized redirect URIs → Add URI**, paste exactly:
   `https://developers.google.com/oauthplayground`
5. **Create**. A popup shows **Client ID** and **Client secret** — keep it open (these are 2 of your 3 values).

## 5. Get the Refresh Token (no coding — via OAuth Playground)
1. Go to https://developers.google.com/oauthplayground/
2. Top-right **⚙ (gear)** → check **"Use your own OAuth credentials"** →
   paste your **Client ID** and **Client secret** from step 4 → Close.
3. Left panel **"Input your own scopes"** box → paste:
   `https://www.googleapis.com/auth/calendar.events`
   → click **Authorize APIs**.
4. Sign in with your Google account. On the "Google hasn't verified this app" screen →
   **Advanced → Go to Portfolio Calendar (unsafe)** → **Continue / Allow**.
   (Safe — it's your own app.)
5. Back in the Playground, click **"Exchange authorization code for tokens"**.
6. Copy the **Refresh token** value (long string). That's your 3rd value.

## 6. Put the 3 values into Vercel
1. https://vercel.com → your `portfolio-tracker` project → **Settings → Environment Variables**.
2. Add three, for **Production**:
   - `GOOGLE_CLIENT_ID` = client id from step 4
   - `GOOGLE_CLIENT_SECRET` = client secret from step 4
   - `GOOGLE_REFRESH_TOKEN` = refresh token from step 5
3. **Redeploy**: Deployments → latest → ⋯ → **Redeploy** (env vars only apply after a redeploy).

## 7. Use it
1. Open the app (https://portfolio-tracker-phi-sooty.vercel.app/) → log in.
2. Click **📆 Sync Calendar** (top bar).
3. It should say `✓ synced N/N to Google`. A "Stocks" calendar appears in Google Calendar
   with your earnings + macro events, each with a 2-day reminder.

(Optional later: a monthly automatic re-sync via Vercel Cron — add once the manual button is confirmed working.)
