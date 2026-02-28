import mongoose from "mongoose";
import { Player } from "./src/models/Player.js";

const run = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/atp_tennis");
    
    // Find 2 players with rank and decay_score
    const players = await Player.find({ 
      rank: { $ne: null }, 
      decay_score: { $ne: null } 
    })
    .limit(2)
    .lean();

    if (players.length < 2) {
      console.log("Not enough players found.");
    } else {
      console.log(JSON.stringify(players.map(p => ({
        id: p._id,
        name: `${p.firstName} ${p.lastName}`,
        rank: p.rank,
        decay: p.decay_score
      })), null, 2));
    }

  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
};

run();
