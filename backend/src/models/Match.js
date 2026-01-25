// src/models/Match.js
import mongoose from "mongoose";

const matchSchema = new mongoose.Schema({
  tourneyId: String,
  tourneyName: String,
  surface: String,
  drawSize: Number,
  tourneyLevel: String,
  tourneyDate: Date,

  matchNum: Number,
  winnerId: Number,
  winnerName: String,
  loserId: Number,
  loserName: String,
  score: String,
  bestOf: Number,
  round: String,
  minutes: Number,

  wAce: Number,
  wDf: Number,
  wSvGms: Number,
  lAce: Number,
  lDf: Number,
  lSvGms: Number,
});

export const Match = mongoose.model("Match", matchSchema);
