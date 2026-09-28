// models/Card.js — Mongoose schema for a tracked credit card.
//
// Same approach as User: an explicit string `id` field so existing
// code that reads card.id / card.userId keeps working unchanged.

const mongoose = require("mongoose");

// One perk/offer entry under a benefit category (e.g. one cashback deal).
const benefitItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    validTill: { type: String, default: null }, // optional "YYYY-MM-DD"
  },
  { _id: false }
);

const benefitsSchema = new mongoose.Schema(
  {
    discountsDeals: { type: [benefitItemSchema], default: [] },
    cashback: { type: [benefitItemSchema], default: [] },
    entertainment: { type: [benefitItemSchema], default: [] },
    foodDining: { type: [benefitItemSchema], default: [] },
    shopping: { type: [benefitItemSchema], default: [] },
    hotels: { type: [benefitItemSchema], default: [] },
  },
  { _id: false }
);

const cardSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  bank: { type: String, required: true },
  type: { type: String, required: true },
  last4: { type: String, required: true },
  dueDate: { type: String, required: true },
  // Optional: the date each statement/bill is generated (a fixed day each
  // month for most cards). Kept separate from dueDate, which is when
  // payment is actually due.
  billGenerationDate: { type: String, default: null },
  totalLimit: { type: Number, required: true },
  usedLimit: { type: Number, default: 0 },
  // Which reminder checkpoints (from REMINDER_DAYS_BEFORE, e.g. [10, 3, 1])
  // have already been emailed for the CURRENT due date. Resets to [] the
  // moment the due date itself changes, so next cycle's reminders fire again.
  remindersSent: { type: [Number], default: [] },
  benefits: { type: benefitsSchema, default: () => ({}) },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

module.exports = mongoose.model("Card", cardSchema);
