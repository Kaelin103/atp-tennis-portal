import mongoose from "mongoose";
import { Player } from "./src/models/Player.js";

const run = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/atp_tennis");
    console.log("✅ Connected to DB: atp_tennis");

    const count = await Player.countDocuments();
    console.log(`Total Players: ${count}`);

    if (count === 0) {
      console.log("❌ No players found.");
      return;
    }

    // 1) 随机拿一个球员，看看字段到底叫什么
    const sample = await Player.findOne().lean();
    console.log("\n--- Random Player keys ---");
    console.log(Object.keys(sample));
    console.log("\n--- Random Player preview ---");
    console.log({
      _id: sample._id,
      firstName: sample.firstName,
      lastName: sample.lastName,
      rank: sample.rank,
      decay_score: sample.decay_score,
      winner_decay: sample.winner_decay,
      loser_decay: sample.loser_decay,
      time_decay: sample.time_decay,
    });

    // 2) 查 rank 有值的数量（确认 rank 是否存在）
    const rankCount = await Player.countDocuments({ rank: { $ne: null } });
    console.log(`\nPlayers with rank != null: ${rankCount}`);

    // 3) 查 decay 相关字段到底哪个存在（都查一遍）
    const decayScoreCount = await Player.countDocuments({ decay_score: { $ne: null } });
    const winnerDecayCount = await Player.countDocuments({ winner_decay: { $ne: null } });
    const loserDecayCount = await Player.countDocuments({ loser_decay: { $ne: null } });
    const timeDecayCount = await Player.countDocuments({ time_decay: { $ne: null } });

    console.log("\n--- Decay field counts ---");
    console.log({
      decay_score: decayScoreCount,
      winner_decay: winnerDecayCount,
      loser_decay: loserDecayCount,
      time_decay: timeDecayCount,
    });

    // 4) 找一个“rank + 任意一种 decay”都存在的球员
    const player = await Player.findOne({
      rank: { $ne: null },
      $or: [
        { decay_score: { $ne: null } },
        { winner_decay: { $ne: null } },
        { time_decay: { $ne: null } },
      ],
    }).lean();

    if (player) {
      console.log("\n✅ Found Player with rank + decay-like field:");
      console.log({
        _id: player._id,
        name: `${player.firstName || ""} ${player.lastName || ""}`.trim(),
        rank: player.rank,
        decay_score: player.decay_score,
        winner_decay: player.winner_decay,
        time_decay: player.time_decay,
      });
    } else {
      console.log("\n⚠️ Players exist but NO player has (rank + any decay-like field).");
      console.log("This means Step2 prediction will fail until you write decay into Player docs (or compute on the fly).");
    }
  } catch (e) {
    console.error("❌ Error:", e);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected.");
  }
};

run();
