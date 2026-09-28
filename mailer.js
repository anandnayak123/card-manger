// mailer.js — sends email via Brevo's HTTPS API (api.brevo.com) instead of
// raw SMTP. This matters because Render's free web services block outbound
// SMTP ports (25/465/587) entirely as of Sept 2025 — an HTTPS API call on
// port 443 is not affected by that restriction.
//
// Required env vars (see .env.example):
//   BREVO_API_KEY, SENDER_EMAIL
// Optional:
//   SENDER_NAME (defaults to "Card Tracker")
//
// If BREVO_API_KEY/SENDER_EMAIL are not set, sendMail() logs a warning and
// skips sending instead of crashing — handy while you're still setting up
// credentials.

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function isConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.SENDER_EMAIL);
}

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.warn(
      `[mailer] Brevo is not configured (BREVO_API_KEY/SENDER_EMAIL missing) — ` +
        `skipped email "${subject}" to ${to}. See .env.example.`
    );
    return { skipped: true };
  }

  const senderName = process.env.SENDER_NAME || "Card Tracker";

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.SENDER_EMAIL, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.message || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Brevo API error (${res.status}): ${detail}`);
  }

  return res.json();
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
