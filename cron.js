// cron.js — schedules a daily check of every card's due date and emails
// the owner if the due date is within REMINDER_DAYS_BEFORE days (or already
// passed). Each due date is only emailed once — the reminder resets
// automatically as soon as the due date itself changes (e.g. after a
// payment that advances it to next month).

const cron = require("node-cron");
const db = require("./db");
const { sendDueDateReminder } = require("./mailer");

function daysBetween(fromDate, toDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

async function checkDueDates() {
  const reminderDays = Number(process.env.REMINDER_DAYS_BEFORE) || 3;
  const today = new Date();
  const cards = await db.getAllCards();

  for (const card of cards) {
    if (!card.dueDate) continue;

    const due = new Date(card.dueDate);
    if (isNaN(due.getTime())) continue;

    const daysLeft = daysBetween(today, due);

    const shouldNotify =
      daysLeft <= reminderDays && card.lastNotifiedDueDate !== card.dueDate;

    if (!shouldNotify) continue;

    const user = await db.getUserById(card.userId);
    if (!user || !user.email) continue;

    try {
      await sendDueDateReminder({
        toEmail: user.email,
        username: user.username,
        card,
        daysLeft,
      });
      await db.setCardNotified(card.id, card.dueDate);
      console.log(
        `[cron] Reminder sent to ${user.email} for ${card.bank} card ending ${card.last4} (${daysLeft} day(s) left).`
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
  console.log("[cron] Due-date reminder job scheduled for 09:00 daily.");
}

module.exports = { start, checkDueDates };
