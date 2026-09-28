// models/User.js — Mongoose schema for a user account.
//
// We keep an explicit string `id` field (instead of relying on Mongo's
// own `_id`) so the rest of the app — routes, session storage, the
// frontend — doesn't need to change at all when moving off the old
// file-based store. `id` is generated the same way it always was
// (db.js's newId()) and is unique/indexed.

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: String, required: true },
});

module.exports = mongoose.model("User", userSchema);
