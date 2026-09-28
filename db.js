// db.js — MongoDB-backed data access layer.
//
// Every exported function here keeps the exact same name and return
// shape as before (plain objects with an `id` field) — the only
// difference is they're now async, so callers need `await`.

const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("./models/User");
const Card = require("./models/Card");

function newId() {
  return crypto.randomBytes(12).toString("hex");
}

// Connects to MongoDB. Call this once, before the server starts
// accepting requests (see server.js).
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your .env locally, or to your " +
        "Render environment variables — see .env.example / README.md."
    );
  }
  await mongoose.connect(uri);
  console.log("[db] Connected to MongoDB.");
}

// Strips Mongo's internal _id / __v fields so callers keep getting the
// same plain-object shape the old JSON-file version returned.
function plain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  delete obj._id;
  delete obj.__v;
  return obj;
}

// ---------- Users ----------
async function getUserByUsername(username) {
  const doc = await User.findOne({ username }).collation({ locale: "en", strength: 2 });
  return plain(doc);
}

async function getUserById(id) {
  const doc = await User.findOne({ id });
  return plain(doc);
}

async function createUser({ username, passwordHash, email }) {
  const doc = await User.create({
    id: newId(),
    username,
    passwordHash,
    email,
    createdAt: new Date().toISOString(),
  });
  return plain(doc);
}

async function updateUserEmail(userId, email) {
  const doc = await User.findOneAndUpdate({ id: userId }, { email }, { new: true });
  return plain(doc);
}

async function getAllUsers() {
  const docs = await User.find({});
  return docs.map(plain);
}

// ---------- Cards ----------
async function getCardsByUser(userId) {
  const docs = await Card.find({ userId });
  return docs.map(plain);
}

async function getCardById(id) {
  const doc = await Card.findOne({ id });
  return plain(doc);
}

async function addCard(userId, card) {
  const doc = await Card.create({
    id: newId(),
    userId,
    bank: card.bank,
    type: card.type,
    last4: card.last4,
    dueDate: card.dueDate,
    billGenerationDate: card.billGenerationDate || null,
    totalLimit: Number(card.totalLimit),
    usedLimit: Number(card.usedLimit) || 0,
    remindersSent: [],
    benefits: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return plain(doc);
}

async function updateCard(id, userId, updates) {
  const card = await Card.findOne({ id, userId });
  if (!card) return null;

  const allowed = [
    "bank",
    "type",
    "last4",
    "dueDate",
    "billGenerationDate",
    "totalLimit",
    "usedLimit",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined && updates[key] !== "") {
      if (key === "totalLimit" || key === "usedLimit") {
        card[key] = Number(updates[key]);
      } else {
        card[key] = updates[key];
      }
    }
  }
  // If the due date moved, the old reminders no longer apply to it —
  // clear the flags so fresh reminders can fire for the new date.
  if (updates.dueDate !== undefined && updates.dueDate !== "") {
    card.remindersSent = [];
  }
  card.updatedAt = new Date().toISOString();
  await card.save();
  return plain(card);
}

async function deleteCard(id, userId) {
  const result = await Card.deleteOne({ id, userId });
  return result.deletedCount > 0;
}

async function markReminderSent(cardId, thresholdDays) {
  const doc = await Card.findOneAndUpdate(
    { id: cardId },
    { $addToSet: { remindersSent: thresholdDays } }, // no duplicate entries
    { new: true }
  );
  return plain(doc);
}

async function getAllCards() {
  const docs = await Card.find({});
  return docs.map(plain);
}

// ---------- Card benefits ----------
const BENEFIT_CATEGORIES = [
  "discountsDeals",
  "cashback",
  "entertainment",
  "foodDining",
  "shopping",
  "hotels",
];

// Replaces one benefit category's entire list of items for one card.
async function setCardBenefitCategory(cardId, userId, category, items) {
  if (!BENEFIT_CATEGORIES.includes(category)) {
    throw new Error("Unknown benefit category: " + category);
  }
  const card = await Card.findOne({ id: cardId, userId });
  if (!card) return null;

  const cleanItems = (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id || newId(),
    title: String(item.title || "").slice(0, 200),
    description: String(item.description || "").slice(0, 500),
    validTill: item.validTill || null,
  }));

  card.benefits[category] = cleanItems;
  card.updatedAt = new Date().toISOString();
  await card.save();
  return plain(card);
}

// Returns [{ cardId, bank, type, last4, items }] across every card this
// user owns that has at least one entry in the given category.
async function getBenefitsByCategoryForUser(userId, category) {
  if (!BENEFIT_CATEGORIES.includes(category)) {
    throw new Error("Unknown benefit category: " + category);
  }
  const cards = await Card.find({ userId });
  return cards
    .map(plain)
    .filter((c) => (c.benefits?.[category] || []).length > 0)
    .map((c) => ({
      cardId: c.id,
      bank: c.bank,
      type: c.type,
      last4: c.last4,
      items: c.benefits[category],
    }));
}

module.exports = {
  connect,
  getUserByUsername,
  getUserById,
  updateUserEmail,
  getAllUsers,
  createUser,
  getCardsByUser,
  getCardById,
  getAllCards,
  addCard,
  updateCard,
  markReminderSent,
  deleteCard,
  BENEFIT_CATEGORIES,
  setCardBenefitCategory,
  getBenefitsByCategoryForUser,
};
