// src/models/Player.js
import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  playerId: { type: Number, unique: true, index: true },
  firstName: String,
  lastName: String,
  hand: String, // R or L
  birthDate: Date,
  countryCode: String,
  rank: { type: Number, default: null },
  decay_score: Number,
  form_score: { type: Number, default: null },  // time-decayed win rate (wWR), 0~1
  form_asof:  { type: Date, default: null },    // score computed up to this date
  form_lambda:{ type: Number, default: null },  // lambda used
});

export const Player = mongoose.model("Player", playerSchema);
