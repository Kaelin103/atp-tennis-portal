import mongoose from "mongoose";
import { Player } from "./src/models/Player.js";

const run = async () => {
  try {
    // Connect to the correct DB (atp_tennis as per .env in backend)
    await mongoose.connect("mongodb://127.0.0.1:27017/atp_tennis");
    console.log("Connected to DB: atp_tennis");
    
    const count = await Player.countDocuments();
    console.log(`Total Players: ${count}`);

    if (count > 0) {
      // Find a player with rank and decay_score
      const player = await Player.findOne({ rank: { $ne: null }, decay_score: { $ne: null } }).lean();
      if (player) {
        console.log("Sample Player with Stats:", player.firstName, player.lastName);
        console.log("Rank:", player.rank);
        console.log("Decay:", player.decay_score);
      } else {
        console.log("Players exist but NO stats (rank/decay) found on sample.");
        // Check a random player to see what they have
        const randomPlayer = await Player.findOne().lean();
        console.log("Random Player:", randomPlayer);
      }
    } else {
      console.log("No players found.");
    }
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
};

run();
