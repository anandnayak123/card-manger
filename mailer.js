// mailer.js — thin wrapper around nodemailer. Reads SMTP settings from
// environment variables so no credentials are hard-coded in the repo.
//
// Required env vars (see .env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
// Optional:
//   SMTP_SECURE ("true"/"false", default false -> STARTTLS on 587)
//
// If SMTP_HOST/USER/PASS are not set, sendMail() logs a warning and
// skips sending instead of crashing — handy while you're still setting
// up credentials.

const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // not configured yet
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: String(SMTP_SECURE).toLowerCase() === "true", // true for 465, false for 587/STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mailer] SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing) — ` +
        `skipped email "${subject}" to ${to}. See .env.example.`
    );
    return { skipped: true };
  }

  const from = process.env.MAIL_FROM || `"Card Tracker" <${process.env.SMTP_USER}>`;

  return t.sendMail({ from, to, subject, html, text });
}

function formatDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

async function sendDueDateReminder({ toEmail, username, card, daysLeft }) {
  const leftover = Number(card.totalLimit) - Number(card.usedLimit);
  const overdue = daysLeft < 0;

  const subject = overdue
    ? `Payment overdue: ${card.bank} card ending ${card.last4}`
    : daysLeft === 0
    ? `Due today: ${card.bank} card ending ${card.last4}`
    : `Payment due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}: ${card.bank} card ending ${card.last4}`;

  const statusLine = overdue
    ? `This bill was due on <strong>${formatDate(card.dueDate)}</strong> and appears to be overdue.`
    : `This bill is due on <strong>${formatDate(card.dueDate)}</strong>.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#1f3864;">Card payment reminder</h2>
      <p>Hi ${username},</p>
      <p>${statusLine}</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#5b6b7a;">Bank</td><td style="padding:6px 0; text-align:right;"><strong>${card.bank}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#5b6b7a;">Card type</td><td style="padding:6px 0; text-align:right;">${card.type}</td></tr>
        <tr><td style="padding:6px 0; color:#5b6b7a;">Card number</td><td style="padding:6px 0; text-align:right;">**** **** **** ${card.last4}</td></tr>
        <tr><td style="padding:6px 0; color:#5b6b7a;">Total limit</td><td style="padding:6px 0; text-align:right;">${Number(card.totalLimit).toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0; color:#5b6b7a;">Used limit</td><td style="padding:6px 0; text-align:right;">${Number(card.usedLimit).toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0; color:#5b6b7a;">Remaining limit</td><td style="padding:6px 0; text-align:right;"><strong>${leftover.toLocaleString()}</strong></td></tr>
      </table>
      <p style="color:#5b6b7a; font-size: 13px;">You're receiving this because you added this card to your Card Tracker account. Log in and record a payment once you've paid your bill so this reminder resets for next month.</p>
    </div>
  `;

  const text = `Hi ${username}, your ${card.bank} card ending ${card.last4} is due on ${formatDate(
    card.dueDate
  )}. Remaining limit: ${leftover}.`;

  return sendMail({ to: toEmail, subject, html, text });
}

module.exports = { sendMail, sendDueDateReminder };
