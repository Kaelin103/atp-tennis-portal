import mongoose from "mongoose";
import { connectDB } from "../../config/db.js";
import { Match } from "../../models/Match.js";
import { Player } from "../../models/Player.js";

const LAMBDA = 0.8;
const DECAY_ENABLED = true;

const smoothRate = (wins, total, alpha = 1, beta = 1) => {
  return (wins + alpha) / (total + alpha + beta);
};

async function updatePlayerStats() {
  console.log("🔄 Updating Player Stats (Rank & Decay Score)...");
  await connectDB();

  // 1. Get max date for decay calculation
  const [row] = await Match.aggregate([
    { $group: { _id: null, maxDate: { $max: "$tourneyDate" } } },
  ]);
  const datasetNow = row?.maxDate || new Date();
  console.log(`📅 Dataset Now: ${datasetNow.toISOString().split("T")[0]}`);

  // 2. Fetch all matches
  console.log("📥 Fetching all matches...");
  const matches = await Match.find({}).sort({ tourneyDate: 1 }).lean();
  console.log(`✅ Fetched ${matches.length} matches.`);

  // 3. Process matches
  const playerStats = new Map(); // playerId -> { rank, wSum, wTotal, lastMatchDate }

  const getStat = (id) => {
    if (!playerStats.has(id)) {
      playerStats.set(id, { rank: null, wSum: 0, wTotal: 0, lastMatchDate: null });
    }
    return playerStats.get(id);
  };

  const getTimeDecay = (date) => {
    if (!DECAY_ENABLED) return 1;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysAgo = (datasetNow - date) / msPerDay;
    if (daysAgo < 0) return 1;
    return Math.exp(-LAMBDA * (daysAgo / 365));
  };

  for (const m of matches) {
    if (!m.winnerId || !m.loserId) continue;
    
    const weight = getTimeDecay(m.tourneyDate);
    
    // Winner
    const wStat = getStat(m.winnerId);
    wStat.wSum += weight;
    wStat.wTotal += weight;
    if (m.winnerRank) wStat.rank = m.winnerRank;
    wStat.lastMatchDate = m.tourneyDate;

    // Loser
    const lStat = getStat(m.loserId);
    // lStat.wSum += 0; // Loss adds 0 to sum
    lStat.wTotal += weight;
    if (m.loserRank) lStat.rank = m.loserRank;
    lStat.lastMatchDate = m.tourneyDate;
  }

  // 4. Bulk Update Players
  console.log(`📝 Preparing updates for ${playerStats.size} players...`);
  const ops = [];
  for (const [playerId, stat] of playerStats.entries()) {
    const decay_score = smoothRate(stat.wSum, stat.wTotal);
    
    ops.push({
      updateOne: {
        filter: { playerId },
        update: {
          $set: {
            rank: stat.rank,
            decay_score: decay_score
          }
        }
      }
    });
  }

  if (ops.length > 0) {
    console.log("💾 executing bulkWrite...");
    const res = await Player.bulkWrite(ops, { ordered: false });
    console.log(`✅ Updated: matched ${res.nMatched}, modified ${res.nModified}`);
  } else {
    console.log("ℹ️ No updates needed.");
  }

  await mongoose.connection.close();
  console.log("🏁 Update complete.");
}

// Run if called directly
import url from "url";
import path from "path";
const currentFile = url.fileURLToPath(import.meta.url);
const calledFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === calledFile) {
  updatePlayerStats();
}
