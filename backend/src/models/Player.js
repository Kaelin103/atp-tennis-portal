// src/models/Player.js
import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  playerId: { type: Number, unique: true, index: true },
  firstName: String,
  lastName: String,
  hand: String, // R or L
  birthDate: Date,
  countryCode: String,
  rank: Number,
  decay_score: Number
});

export const Player = mongoose.model("Player", playerSchema);
