// src/loaders/seed/index.js
import { loadPlayers } from "./loadPlayers.js";
import { loadMatches } from "./loadMatches.js";
import { connectDB } from "../../config/db.js";
import mongoose from "mongoose";
import { Player } from "../../models/Player.js";
import { Match } from "../../models/Match.js";

async function main() {
  console.log("🚀 Starting full dataset import...");
  await connectDB();
  const playerCount = await Player.countDocuments();
  const matchCount = await Match.countDocuments();
  await mongoose.connection.close();

  if (playerCount === 0) {
    await loadPlayers();
  } else {
    console.log(`ℹ️ Players already present: ${playerCount}. Skipping loadPlayers.`);
  }

  if (matchCount === 0) {
    await loadMatches();
  } else {
    console.log(`ℹ️ Matches already present: ${matchCount}. Skipping loadMatches.`);
  }
  console.log("✅ Seed process completed.");
}

main();
