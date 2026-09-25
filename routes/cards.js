const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendDueDateReminder } = require("../mailer");

const router = express.Router();
router.use(requireAuth);

function serializeCard(card) {
  const leftoverLimit = Number(card.totalLimit) - Number(card.usedLimit);
  const usagePercent =
    card.totalLimit > 0 ? Math.round((card.usedLimit / card.totalLimit) * 1000) / 10 : 0;
  return { ...card, leftoverLimit, usagePercent };
}

function validateCardInput(body, { partial = false } = {}) {
  const errors = [];
  const { bank, type, last4, dueDate, totalLimit, usedLimit } = body || {};

  if (!partial || bank !== undefined) {
    if (!bank || typeof bank !== "string" || bank.trim().length < 2) {
      errors.push("Bank name is required.");
    }
  }
  if (!partial || type !== undefined) {
    if (!type || typeof type !== "string") {
      errors.push("Card type is required.");
    }
  }
  if (!partial || last4 !== undefined) {
    if (!last4 || !/^\d{4}$/.test(String(last4))) {
      errors.push("Last four digits must be exactly 4 numbers.");
    }
  }
  if (!partial || dueDate !== undefined) {
    if (!dueDate || isNaN(Date.parse(dueDate))) {
      errors.push("A valid due date is required.");
    }
  }
  if (!partial || totalLimit !== undefined) {
    if (totalLimit === undefined || isNaN(Number(totalLimit)) || Number(totalLimit) <= 0) {
      errors.push("Total limit must be a positive number.");
    }
  }
  if (usedLimit !== undefined) {
    if (isNaN(Number(usedLimit)) || Number(usedLimit) < 0) {
      errors.push("Used limit must be zero or a positive number.");
    }
  }
  return errors;
}

// GET /api/cards
router.get("/", async (req, res) => {
  const cards = (await db.getCardsByUser(req.session.userId)).map(serializeCard);
  res.json(cards);
});

// POST /api/cards
router.post("/", async (req, res) => {
  const errors = validateCardInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  if (Number(req.body.usedLimit || 0) > Number(req.body.totalLimit)) {
    return res.status(400).json({ error: "Used limit cannot exceed total limit." });
  }

  const card = await db.addCard(req.session.userId, req.body);
  res.status(201).json(serializeCard(card));
});

// PUT /api/cards/:id  (edit any field)
router.put("/:id", async (req, res) => {
  const existing = await db.getCardById(req.params.id);
  if (!existing || existing.userId !== req.session.userId) {
    return res.status(404).json({ error: "Card not found." });
  }

  const errors = validateCardInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const nextTotal =
    req.body.totalLimit !== undefined ? Number(req.body.totalLimit) : existing.totalLimit;
  const nextUsed =
    req.body.usedLimit !== undefined ? Number(req.body.usedLimit) : existing.usedLimit;
  if (nextUsed > nextTotal) {
    return res.status(400).json({ error: "Used limit cannot exceed total limit." });
  }

  const updated = await db.updateCard(req.params.id, req.session.userId, req.body);
  res.json(serializeCard(updated));
});

// POST /api/cards/:id/payment  (record a bill payment -> reduces used limit)
router.post("/:id/payment", async (req, res) => {
  const existing = await db.getCardById(req.params.id);
  if (!existing || existing.userId !== req.session.userId) {
    return res.status(404).json({ error: "Card not found." });
  }

  const { amount, advanceDueDate, nextDueDate } = req.body || {};
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: "Payment amount must be a positive number." });
  }

  const newUsed = Math.max(0, Number(existing.usedLimit) - amt);
  const updates = { usedLimit: newUsed };

  if (advanceDueDate && nextDueDate && !isNaN(Date.parse(nextDueDate))) {
    updates.dueDate = nextDueDate;
  }

  const updated = await db.updateCard(req.params.id, req.session.userId, updates);
  res.json(serializeCard(updated));
});

// POST /api/cards/:id/send-test-reminder
// Sends a reminder email immediately, regardless of how many days are left —
// useful for confirming your SMTP settings work before relying on the
// daily automatic check.
router.post("/:id/send-test-reminder", async (req, res) => {
  const card = await db.getCardById(req.params.id);
  if (!card || card.userId !== req.session.userId) {
    return res.status(404).json({ error: "Card not found." });
  }
  const user = await db.getUserById(req.session.userId);
  if (!user || !user.email) {
    return res.status(400).json({ error: "Add an email address to your profile first." });
  }

  const daysLeft = Math.round((new Date(card.dueDate) - new Date()) / (1000 * 60 * 60 * 24));

  try {
    const result = await sendDueDateReminder({
      toEmail: user.email,
      username: user.username,
      card,
      daysLeft,
    });
    if (result && result.skipped) {
      return res.status(503).json({
        error: "SMTP is not configured on the server yet — see .env.example.",
      });
    }
    res.json({ ok: true, sentTo: user.email });
  } catch (err) {
    res.status(500).json({ error: "Failed to send email: " + err.message });
  }
});

// DELETE /api/cards/:id
router.delete("/:id", async (req, res) => {
  const ok = await db.deleteCard(req.params.id, req.session.userId);
  if (!ok) return res.status(404).json({ error: "Card not found." });
  res.json({ ok: true });
});

module.exports = router;
