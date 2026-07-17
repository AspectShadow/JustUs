# Just Us

A shared app for the two of you — a to-do list, timed reminders (plus an
hourly water reminder), and a live sketch board — with real push
notifications on both your phones.

This is a real Next.js app you deploy yourself on Vercel, the same way you
deployed Sitezyn. It's not something that runs inside a Claude chat.

---

## What you'll need (all free)

1. A GitHub account (you already have one)
2. A Vercel account (you already have one)
3. A free **cron-job.org** account — this is what actually triggers your
   reminders on schedule, because Vercel's own free-tier cron only runs
   once a day, which is too slow for hourly/timed reminders.

---

## 1. Push this to GitHub

Create a new repo (separate from Sitezyn) and push this folder to it,
same flow as before:

```
cd justus-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/justus-app.git
git push -u origin main
```

## 2. Import into Vercel

- Vercel dashboard → **Add New → Project** → import the `justus-app` repo
- Framework preset: Next.js (auto-detected)
- Don't deploy yet — add the environment variables first (next step)

## 3. Add Vercel KV (the database)

- In your new Vercel project → **Storage** tab → **Create Database** → KV
- Connect it to this project — Vercel automatically adds the `KV_*`
  environment variables for you

## 4. Generate your VAPID keys (for push notifications)

On your own machine, inside the project folder:

```
npm install
npm run generate-vapid
```

This prints something like:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=xY...
```

## 5. Set environment variables in Vercel

Project → **Settings → Environment Variables** → add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | from step 4 |
| `VAPID_PRIVATE_KEY` | from step 4 |
| `VAPID_SUBJECT` | `mailto:your@email.com` |
| `CRON_SECRET` | any long random string you make up |

(The `KV_*` variables were already added automatically in step 3.)

## 6. Deploy

Back on the import screen (or **Deployments → Redeploy** if you already
deployed), hit deploy. You'll get a URL like
`https://justus-app.vercel.app`.

## 7. Set up the free scheduler (this is what makes reminders actually fire)

- Go to **cron-job.org** → sign up free → **Create cronjob**
- URL: `https://justus-app.vercel.app/api/cron/check?secret=YOUR_CRON_SECRET`
  (use the same `CRON_SECRET` value from step 5)
- Schedule: every 5 minutes
- Save and enable it

That's the piece that checks your reminders and water timer and sends
the actual push notification, even while the app is closed.

## 8. Install it on both phones

**Android (Chrome):** open the URL → you can use it straight away, or tap
**Add to Home Screen** from the browser menu for the full app feel.

**iPhone (Safari):** this step matters — iOS only allows push
notifications for PWAs added to the home screen, not for regular Safari
tabs.
1. Open the URL in Safari
2. Tap the Share icon → **Add to Home Screen**
3. Open the app from the new home screen icon (not from Safari)
4. Inside the app, tap **"Tap to turn on notifications"**

Do this on both your phones. Once both are subscribed, reminders and the
water nudge will reach you even when the app is closed.

---

## Notes & limits

- Reminder times assume you're both in **India (Asia/Kolkata)**. If
  that's ever not true, change `TIMEZONE` in
  `app/api/cron/check/route.js`.
- Everything (to-dos, reminders, sketch) is shared — there's no login,
  so anyone with the link could see or edit it. Fine for the two of you,
  just don't post the link publicly.
- Reminder timing is accurate to within about 5 minutes, since it's
  checked on a schedule rather than instantly.
- If a notification stops arriving on one phone, it likely means that
  phone's subscription expired — just reopen the app and tap "turn on
  notifications" again.
