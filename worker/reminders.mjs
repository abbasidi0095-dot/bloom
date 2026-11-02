#!/usr/bin/env node
/* Bloom reminder worker — runs every 30 seconds on the VPS. */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import webpush from "web-push";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const connectionString = process.env.WORKER_DATABASE_URL;
if (!connectionString) {
  console.error("[worker] WORKER_DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, max: 3, application_name: "bloom-worker" });
const vapidReady = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:hello@bloom.local",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const copy = {
  en: { title: "Time for {label}", body: "A gentle reminder from Bloom." },
  fr: { title: "C'est l'heure : {label}", body: "Un doux rappel de Bloom." },
  es: { title: "Es hora de {label}", body: "Un recordatorio suave de Bloom." },
  ar: { title: "حان وقت {label}", body: "تذكير لطيف من Bloom." },
};

function localTime(timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? 0),
  };
}

function inQuietHours(profile) {
  if (!profile.quiet_start || !profile.quiet_end) return false;
  const now = localTime(profile.timezone || "UTC");
  const minutes = now.hour * 60 + now.minute;
  const [startH, startM] = String(profile.quiet_start).split(":").map(Number);
  const [endH, endM] = String(profile.quiet_end).split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function nextDaily(reminder, timeZone) {
  const times = Array.isArray(reminder.times) && reminder.times.length ? reminder.times : ["09:00"];
  const allowed = Array.isArray(reminder.days) && reminder.days.length ? new Set(reminder.days) : null;
  const now = Date.now();
  for (let offset = 0; offset < 8; offset += 1) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + offset);
    const key = base.toISOString().slice(0, 10);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (allowed && !allowed.has(weekday)) continue;
    for (const time of [...times].sort()) {
      const guess = new Date(`${key}T${time}:00Z`);
      const offsetMinutes = tzOffsetMinutes(guess, timeZone);
      const due = new Date(guess.getTime() - offsetMinutes * 60000);
      if (due.getTime() > now) return due;
    }
  }
  return null;
}

function tzOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") === 24 ? 0 : get("hour"), get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}

async function deliverPush(subscriptions, payload) {
  if (!vapidReady) return;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      await pool.query("update push_subscriptions set last_used_at = now() where id = $1", [sub.id]);
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await pool.query("delete from push_subscriptions where id = $1", [sub.id]);
      } else {
        console.error("[worker] push failed", error?.statusCode ?? error?.message);
      }
    }
  }
}

async function tick() {
  const due = await pool.query(
    `select r.*, f.name as family_name
       from reminders r
       join families f on f.id = r.family_id
      where r.enabled and r.deleted_at is null and r.next_due_at is not null and r.next_due_at <= now()
      order by r.next_due_at asc
      limit 50`,
  );

  for (const reminder of due.rows) {
    const members = await pool.query(
      `select u.id, u.name, p.locale, p.timezone, p.quiet_start, p.quiet_end, p.push_enabled
         from family_members fm
         join users u on u.id = fm.user_id
         join profiles p on p.user_id = u.id
        where fm.family_id = $1 and fm.status = 'active'`,
      [reminder.family_id],
    );

    const slot = new Date(reminder.next_due_at).toISOString();
    for (const member of members.rows) {
      const locale = copy[member.locale] ? member.locale : "en";
      const title = copy[locale].title.replace("{label}", reminder.label);
      const body = copy[locale].body;
      const dedupe = `${reminder.id}:${slot}:${member.id}`;
      const inserted = await pool.query(
        `insert into notifications (user_id, family_id, reminder_id, title, body, url, dedupe_key)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (dedupe_key) where dedupe_key is not null do nothing
         returning id`,
        [member.id, reminder.family_id, reminder.id, title, body, "/dashboard", dedupe],
      );
      if (!inserted.rows[0]) continue;

      if (!inQuietHours(member) && member.push_enabled) {
        const subs = await pool.query(
          `select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1`,
          [member.id],
        );
        await deliverPush(subs.rows, {
          title,
          body,
          url: "/dashboard",
          tag: `bloom-${reminder.id}`,
        });
      }
      await pool.query("update notifications set read_at = null where id = $1", [inserted.rows[0].id]);
    }

    const tz = members.rows[0]?.timezone || "UTC";
    let next = null;
    if (reminder.schedule_kind === "interval") {
      next = new Date(Date.now() + (reminder.interval_minutes || 180) * 60000);
    } else {
      next = nextDaily(reminder, tz);
    }
    await pool.query(
      "update reminders set last_fired_at = now(), next_due_at = $1 where id = $2",
      [next, reminder.id],
    );
    console.log(`[worker] fired ${reminder.id} (${reminder.label}) -> ${next?.toISOString() ?? "paused"}`);
  }
}

let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});

async function loop() {
  while (running) {
    try {
      await tick();
    } catch (error) {
      console.error("[worker] tick failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  await pool.end();
  process.exit(0);
}

loop();
