// db.js — MongoDB-backed data access layer.
//
// This used to be a very small file-based "database" that stored
// everything in data/data.json. That worked for local testing, but on
// Render's free tier (and most hosts) the filesystem isn't persistent —
// it gets wiped on every redeploy/restart. This version stores users
// and cards in MongoDB (e.g. a free MongoDB Atlas cluster) instead, so
// data survives deploys and restarts.
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
    totalLimit: Number(card.totalLimit),
    usedLimit: Number(card.usedLimit) || 0,
    lastNotifiedDueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return plain(doc);
}

async function updateCard(id, userId, updates) {
  const card = await Card.findOne({ id, userId });
  if (!card) return null;

  const allowed = ["bank", "type", "last4", "dueDate", "totalLimit", "usedLimit"];
  for (const key of allowed) {
    if (updates[key] !== undefined && updates[key] !== "") {
      if (key === "totalLimit" || key === "usedLimit") {
        card[key] = Number(updates[key]);
      } else {
        card[key] = updates[key];
      }
    }
  }
  // If the due date moved, the old reminder no longer applies to it —
  // clear the flag so a fresh reminder can fire for the new date.
  if (updates.dueDate !== undefined && updates.dueDate !== "") {
    card.lastNotifiedDueDate = null;
  }
  card.updatedAt = new Date().toISOString();
  await card.save();
  return plain(card);
}

async function deleteCard(id, userId) {
  const result = await Card.deleteOne({ id, userId });
  return result.deletedCount > 0;
}

async function setCardNotified(cardId, dueDateValue) {
  const doc = await Card.findOneAndUpdate(
    { id: cardId },
    { lastNotifiedDueDate: dueDateValue },
    { new: true }
  );
  return plain(doc);
}

async function getAllCards() {
  const docs = await Card.find({});
  return docs.map(plain);
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
  setCardNotified,
  deleteCard,
};
