// cron.js — schedules a daily check of every card's due date and emails
// the owner at each configured checkpoint (default: 10, 3, and 1 days
// before the due date). Each checkpoint is only emailed once per due
// date — the reminders reset automatically as soon as the due date
// itself changes (e.g. after a payment that advances it to next month).

const cron = require("node-cron");
const db = require("./db");
const { sendDueDateReminder } = require("./mailer");

function daysBetween(fromDate, toDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

// Parses "10,3,1" -> [10, 3, 1] (sorted descending, invalid entries dropped).
// Falls back to [10, 3, 1] if the env var is missing or unparseable.
function getReminderThresholds() {
  const raw = process.env.REMINDER_DAYS_BEFORE;
  if (!raw) return [10, 3, 1];

  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  if (parsed.length === 0) return [10, 3, 1];
  return [...new Set(parsed)].sort((a, b) => b - a);
}

async function checkDueDates() {
  const thresholds = getReminderThresholds();
  const today = new Date();
  const cards = await db.getAllCards();

  for (const card of cards) {
    if (!card.dueDate) continue;

    const due = new Date(card.dueDate);
    if (isNaN(due.getTime())) continue;

    const daysLeft = daysBetween(today, due);
    const alreadySent = card.remindersSent || [];

    // Every checkpoint that has been reached but not yet handled.
    const pending = thresholds.filter((t) => daysLeft <= t && !alreadySent.includes(t));
    if (pending.length === 0) continue;

    // If several are pending at once (card added close to its due date, or
    // the server slept through a day), send ONE email for the most urgent
    // checkpoint and quietly mark the earlier ones as done — no email spam.
    const mostUrgent = Math.min(...pending);

    const user = await db.getUserById(card.userId);
    if (!user || !user.email) continue;

    try {
      await sendDueDateReminder({
        toEmail: user.email,
        username: user.username,
        card,
        daysLeft,
      });
      for (const t of pending) await db.markReminderSent(card.id, t);
      console.log(
        `[cron] Reminder (${mostUrgent}-day checkpoint) sent to ${user.email} for ${card.bank} card ending ${card.last4} (${daysLeft} day(s) left).`
      );
    } catch (err) {
      console.error(`[cron] Failed to send reminder for card ${card.id}:`, err.message);
    }
  }
}

function start() {
  // Runs once every day at 09:00 server time.
  cron.schedule("0 9 * * *", () => {
    checkDueDates().catch((err) => console.error("[cron] checkDueDates error:", err));
  });
  const thresholds = getReminderThresholds().join(", ");
  console.log(`[cron] Due-date reminder job scheduled for 09:00 daily (checkpoints: ${thresholds} day(s) before due).`);
}

module.exports = { start, checkDueDates };
