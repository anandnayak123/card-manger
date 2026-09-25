const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

function isValidUsername(u) {
  return typeof u === "string" && /^[a-zA-Z0-9_.-]{3,30}$/.test(u);
}

function isValidEmail(e) {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password, email } = req.body || {};

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: "Username must be 3-30 characters (letters, numbers, _ . -).",
    });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "A valid email address is required — due-date reminders are sent there.",
    });
  }
  if (await db.getUserByUsername(username)) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.createUser({ username, passwordHash, email });

  req.session.userId = user.id;
  req.session.username = user.username;

  res.status(201).json({ id: user.id, username: user.username, email: user.email });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = await db.getUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  req.session.userId = user.id;
  req.session.username = user.username;

  res.json({ id: user.id, username: user.username });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  if (req.session && req.session.userId) {
    const user = await db.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ id: user.id, username: user.username, email: user.email });
  }
  res.status(401).json({ error: "Not authenticated." });
});

// PUT /api/auth/email — update the address reminders are sent to
router.put("/email", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  const { email } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }
  const user = await db.updateUserEmail(req.session.userId, email);
  res.json({ id: user.id, username: user.username, email: user.email });
});

module.exports = router;
