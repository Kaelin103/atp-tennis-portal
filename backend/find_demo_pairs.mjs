import mongoose from "mongoose";
import { Player } from "./src/models/Player.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/atp_tennis";

function showPlayer(p) {
  return {
    id: String(p._id),
    name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
    rank: p.rank,
    decay_score: p.decay_score,
  };
}

async function pickOne(query, sort) {
  return Player.findOne(query).sort(sort).lean();
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected:", MONGO_URI);

  // 基本约束：rank/decay_score 都要存在且可用
  const baseQuery = {
    rank: { $ne: null },
    decay_score: { $ne: null },
  };

  // 1) 时间特征“强对比”演示：
  //    rank 尽量相近（同一档位），但 decay_score 一高一低 => dDecay 明显 ≠ 0
  //    思路：先找一个 decay 极高/极低的人，再找同 rank 档位的人
  
  let p1, p2;
  
  // Try high decay first
  p1 = await pickOne({...baseQuery, decay_score: {$gte: 0.55}}, {decay_score: -1});
  if (p1) {
      const rMin = Math.max(1, p1.rank - 40);
      const rMax = p1.rank + 40;
      p2 = await pickOne({...baseQuery, rank: {$gte: rMin, $lte: rMax}, decay_score: {$lte: 0.48}}, {decay_score: 1});
  }

  // If fail, try low decay first
  if (!p1 || !p2) {
      p1 = await pickOne({...baseQuery, decay_score: {$lte: 0.45}}, {decay_score: 1});
      if (p1) {
          const rMin = Math.max(1, p1.rank - 40);
          const rMax = p1.rank + 40;
          p2 = await pickOne({...baseQuery, rank: {$gte: rMin, $lte: rMax}, decay_score: {$gte: 0.52}}, {decay_score: -1});
      }
  }

  console.log("\n==============================");
  console.log("🎯 Demo Pair #1: SAME rank-band, VERY different decay_score (show time-aware effect)");
  if (p1 && p2) {
      console.log("Rank band:", `[${Math.min(p1.rank, p2.rank)}, ${Math.max(p1.rank, p2.rank)}]`);
      console.log("Player A:", showPlayer(p1));
      console.log("Player B:", showPlayer(p2));
  } else {
      console.log("NOT FOUND - Try updating decay scores or check data distribution.");
  }

  // 2) rank “强对比”演示：
  //    decay_score 尽量相近，但 rank 差距很大 => dRank 影响明显
  //    思路：先选一个 decay ~ 0.50 的人，再找同 decay 档位但 rank 很强/很弱的人
  const decayMid = await pickOne(
    {
      ...baseQuery,
      decay_score: { $gte: 0.45, $lte: 0.55 },
    },
    { rank: 1 }
  );

  const strongRankSameDecay = await pickOne(
    {
      ...baseQuery,
      decay_score: { $gte: 0.45, $lte: 0.55 },
      rank: { $lte: 50 },
    },
    { rank: 1 }
  );

  const weakRankSameDecay = await pickOne(
    {
      ...baseQuery,
      decay_score: { $gte: 0.45, $lte: 0.55 },
      rank: { $gte: 400 },
    },
    { rank: -1 }
  );

  console.log("\n==============================");
  console.log("🎯 Demo Pair #2: Similar decay_score (~0.50), VERY different rank (show baseline rank effect)");
  console.log("Reference mid-decay player:", decayMid ? showPlayer(decayMid) : "NOT FOUND");
  console.log("Player A (strong rank):", strongRankSameDecay ? showPlayer(strongRankSameDecay) : "NOT FOUND");
  console.log("Player B (weak   rank):", weakRankSameDecay ? showPlayer(weakRankSameDecay) : "NOT FOUND");

  console.log("\n✅ Copy the 'id' values into /predict page to test.\n");

  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error("❌ Error:", e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
