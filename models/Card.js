// models/Card.js — Mongoose schema for a tracked credit card.
//
// Same approach as User: an explicit string `id` field so existing
// code that reads card.id / card.userId keeps working unchanged.

const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  bank: { type: String, required: true },
  type: { type: String, required: true },
  last4: { type: String, required: true },
  dueDate: { type: String, required: true },
  totalLimit: { type: Number, required: true },
  usedLimit: { type: Number, default: 0 },
  lastNotifiedDueDate: { type: String, default: null },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

module.exports = mongoose.model("Card", cardSchema);
