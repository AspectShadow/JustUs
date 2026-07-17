import { getJSON, setJSON } from "@/lib/db";
import { broadcastPush } from "@/lib/push";

// How this gets called every few minutes:
// An external free scheduler (e.g. cron-job.org) hits this URL on a
// schedule, e.g. https://your-app.vercel.app/api/cron/check?secret=XXXX
// Vercel's own Hobby-plan cron only runs once a day, which is too
// infrequent for timed reminders, so we don't rely on it here.

const WATER_INTERVAL_MIN = 60;
const TIMEZONE = "Asia/Kolkata"; // change if you're not both in India

function nowInTZ() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour").value;
  const mm = parts.find((p) => p.type === "minute").value;
  return { label: `${hh}:${mm}`, minutes: parseInt(hh, 10) * 60 + parseInt(mm, 10) };
}

function todayKeyInTZ() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date()); // YYYY-MM-DD
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret") || req.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { remindersFired: [], waterFired: false };

  // ---- timed reminders ----
  const reminders = await getJSON("reminders", []);
  const today = todayKeyInTZ();
  const { label: nowLabel, minutes: nowMinutes } = nowInTZ();
  let remindersChanged = false;

  for (const r of reminders) {
    if (r.lastFiredDate === today) continue;
    const [rh, rm] = r.time.split(":").map(Number);
    const remMinutes = rh * 60 + rm;
    // fire if the scheduled minute has passed within the last 6 minutes
    // (covers gaps between scheduler runs)
    const diff = nowMinutes - remMinutes;
    if (diff >= 0 && diff <= 6) {
      await broadcastPush("Reminder", r.text);
      r.lastFiredDate = today;
      remindersChanged = true;
      results.remindersFired.push(r.text);
    }
  }
  if (remindersChanged) await setJSON("reminders", reminders);

  // ---- water reminder ----
  const water = await getJSON("water", { enabled: false, lastDrink: Date.now(), lastNotifiedAt: 0 });
  if (water.enabled) {
    const dueAt = water.lastDrink + WATER_INTERVAL_MIN * 60000;
    if (Date.now() >= dueAt && water.lastNotifiedAt < dueAt) {
      await broadcastPush("Time to drink water 💧", "It's been an hour — go grab a glass.");
      water.lastNotifiedAt = Date.now();
      await setJSON("water", water);
      results.waterFired = true;
    }
  }

  return Response.json({ ok: true, checkedAt: nowLabel, ...results });
}
