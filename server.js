require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const db = require("./db");
const authRoutes = require("./routes/auth");
const cardRoutes = require("./routes/cards");
const reminderCron = require("./cron");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn(
    "[server] WARNING: SESSION_SECRET is not set in your environment. " +
      "Using an insecure default — set SESSION_SECRET before deploying publicly."
  );
}

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      // secure: true, // enable this once you're serving over HTTPS
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/cards", cardRoutes);

// Fallback: anything else under /api that wasn't matched
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// Connect to MongoDB first, then start accepting requests. If the
// connection fails (bad/missing MONGODB_URI), fail loudly at startup
// instead of limping along and erroring on every request later.
db.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Card Tracker running at http://localhost:${PORT}`);
      reminderCron.start();
    });
  })
  .catch((err) => {
    console.error("[server] Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
