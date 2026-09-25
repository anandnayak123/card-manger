# Card Tracker

A small full-stack prototype for tracking credit card limits and due dates:

- Basic username/password authentication (sessions, hashed passwords)
- Add a card: bank, type, last 4 digits, due date, total limit, used limit
- Dashboard shows remaining limit and due date for every card, with a
  usage progress bar and a "days until due" badge
- Record a bill payment (reduces used limit) and optionally push the due
  date to next month in the same step
- Edit or delete any card
- **Email reminders**: a daily background check emails you when a card's
  due date is within N days (default 3) — or overdue — using your own
  SMTP account. Reminders only fire once per due date.

> ⚠️ This stores only the **last 4 digits** of each card, never a full
> card number — please keep it that way. This is a learning/prototype
> project, not a PCI-compliant production system. See "Before going to
> production" below.

## 1. Requirements

- Node.js 16 or newer
- A free MongoDB Atlas cluster (see step 2 below) — this is where all
  users and cards are stored, so data survives restarts and redeploys
- An SMTP account to send email from (Gmail, Outlook, SendGrid, Mailgun,
  your hosting provider's SMTP, etc.) — optional; the app runs fine
  without it, it just won't send reminder emails until configured.

## 2. Set up a free MongoDB database

The app needs somewhere persistent to store users and cards. MongoDB
Atlas has a free tier (called M0) that's more than enough for this app
and never expires:

1. Go to [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. When prompted to create a cluster, choose the **M0 Free** tier and
   any region close to you, then click **Create**.
3. Under **Security → Database Access**, add a database user with a
   username and password (click "Autogenerate Secure Password" and
   save it somewhere — you'll need it in a moment).
4. Under **Security → Network Access**, click **Add IP Address** →
   **Allow Access from Anywhere** (`0.0.0.0/0`). This is fine for this
   project; a production app with sensitive data would restrict this
   further.
5. Go back to your cluster, click **Connect** → **Drivers**, and copy
   the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Paste it into `MONGODB_URI` in your `.env` (step 3 below), replacing
   `<username>` and `<password>` with the database user you created,
   and adding a database name before the `?`, e.g. `.../card-tracker?retryWrites=...`.

## 3. Setup

```bash
cd card-tracker
npm install
cp .env.example .env
```

Open `.env` and fill in:

- `MONGODB_URI` — the connection string from step 2 above.
- `SESSION_SECRET` — any long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — your
  email provider's SMTP details (see comments in `.env.example` for a
  Gmail example using an App Password).
- `REMINDER_DAYS_BEFORE` — how many days ahead of the due date to start
  emailing (default `3`).

## 4. Run it

```bash
npm start
```

You should see `[db] Connected to MongoDB.` in the terminal, then open
**http://localhost:3000** — sign up for an account, add a card, and try
"Test Email" on a card tile to confirm SMTP works without waiting for
the daily 9am check.

## 5. How reminders work

A daily job (`cron.js`, using `node-cron`) runs at 09:00 server time and
checks every card's due date:

- If `daysLeft <= REMINDER_DAYS_BEFORE` (including 0 or negative /
  overdue), and this exact due date hasn't already been emailed about,
  it sends a reminder to the account's registered email.
- Once you record a payment with "advance due date" checked (or edit the
  due date directly), the reminder flag resets automatically so you'll
  be notified again next cycle.
- Each card's "Test Email" button sends a reminder immediately,
  regardless of how many days are left — handy for checking your SMTP
  setup works.

If SMTP isn't configured, the server logs a warning and skips sending
instead of crashing, so the rest of the app still works.

## 6. Project structure

```
card-tracker/
├── server.js          # Express app entry point; connects to MongoDB, then listens
├── db.js              # data access layer, backed by MongoDB (via Mongoose)
├── models/
│   ├── User.js          # Mongoose schema for user accounts
│   └── Card.js           # Mongoose schema for tracked cards
├── mailer.js           # nodemailer wrapper + reminder email template
├── cron.js             # daily due-date check that triggers emails
├── middleware/
│   └── auth.js         # requireAuth guard for API routes
├── routes/
│   ├── auth.js          # register / login / logout / profile
│   └── cards.js         # card CRUD + payment + test-reminder
├── public/              # static frontend (no build step needed)
│   ├── index.html        # login / sign up
│   ├── dashboard.html    # main app
│   ├── css/style.css
│   └── js/{auth.js, dashboard.js}
├── .env.example
└── package.json
```

## 7. Hosting this

This is a plain Node.js app, so it runs on almost any Node host:

- **Render / Railway / Fly.io / Heroku-style PaaS**: push the folder as
  a repo, set the same variables from `.env` (including `MONGODB_URI`)
  in their dashboard's "Environment Variables" section, set the start
  command to `npm start`. Since data now lives in MongoDB Atlas rather
  than on local disk, it survives redeploys and restarts on these
  platforms without any extra configuration.
- **A VPS**: `npm install --production`, copy your `.env`, run with
  `pm2 start server.js` (or a systemd service) behind Nginx as a
  reverse proxy with HTTPS (e.g. via Certbot).
- **Docker**: not included here, but a minimal `Dockerfile` would be:
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm install --production
  COPY . .
  EXPOSE 3000
  CMD ["npm", "start"]
  ```

## 8. Before going to production

This project intentionally stays simple for learning/prototyping. If
you plan to let real people store real data, at minimum you should:

- Set `cookie.secure = true` in `server.js` once you're serving over
  HTTPS (required for cookies to be sent correctly in production).
- Add rate limiting on `/api/auth/login` and `/api/auth/register` to
  slow down brute-force attempts.
- Add CSRF protection if you add any state-changing GET-triggered
  actions.
- Consider email verification during sign-up so reminders can't be sent
  to addresses the user doesn't own.
- Tighten MongoDB Atlas's Network Access list beyond "Allow Access from
  Anywhere" once you know the fixed IP range(s) your host deploys from.
- Run behind HTTPS end-to-end and set proper security headers (e.g. via
  `helmet`).
