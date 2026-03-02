import mongoose from "mongoose";
import { connectDB } from "../../config/db.js";
import { Match } from "../../models/Match.js";
import { Player } from "../../models/Player.js";
import url from "url";
import path from "path";

// 0.005 daily decay is a common starting point for sports ratings (approx 140 days half-life)
// Adjust if needed to match R logic exactly.
const LAMBDA_DAILY = 0.005; 
const PRIOR_WINS = 1; // Alpha
const PRIOR_GAMES = 2; // Alpha + Beta (assuming Beta=1) -> 1+1=2

async function updatePlayerStats() {
  console.log("🔄 Updating Player Stats (Rank & Form Score)...");
  await connectDB();

  // 1. Fetch all matches sorted by date
  console.log("📥 Fetching all matches...");
  const matches = await Match.find({}).sort({ tourneyDate: 1 }).lean();
  console.log(`✅ Fetched ${matches.length} matches.`);

  // 2. Process matches
  // Map: playerId -> { wins, games, lastDate, rank }
  const playerStats = new Map();

  const getStat = (id) => {
    if (!playerStats.has(id)) {
      playerStats.set(id, { 
        wins: 0, 
        games: 0, 
        lastDate: null, 
        rank: null 
      });
    }
    return playerStats.get(id);
  };

  const applyDecay = (stat, currentDate) => {
    if (!stat.lastDate) {
      stat.lastDate = currentDate;
      return;
    }
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffTime = currentDate - stat.lastDate;
    const diffDays = diffTime / msPerDay;

    if (diffDays > 0) {
      const decayFactor = Math.exp(-LAMBDA_DAILY * diffDays);
      stat.wins *= decayFactor;
      stat.games *= decayFactor;
    }
    stat.lastDate = currentDate;
  };

  let processedCount = 0;
  for (const m of matches) {
    if (!m.winnerId || !m.loserId || !m.tourneyDate) continue;

    const date = new Date(m.tourneyDate);
    
    // Winner
    const wStat = getStat(m.winnerId);
    applyDecay(wStat, date);
    wStat.wins += 1;
    wStat.games += 1;
    if (m.winnerRank) wStat.rank = m.winnerRank;

    // Loser
    const lStat = getStat(m.loserId);
    applyDecay(lStat, date);
    // lStat.wins += 0;
    lStat.games += 1;
    if (m.loserRank) lStat.rank = m.loserRank;
    
    processedCount++;
  }
  console.log(`✅ Processed stats for ${processedCount} valid matches.`);

  // 3. Bulk Update Players
  console.log(`📝 Preparing updates for ${playerStats.size} players...`);
  const ops = [];
  
  for (const [playerId, stat] of playerStats.entries()) {
    // Calculate final form_score
    // form_score = (wins + prior) / (games + 2*prior)
    const form_score = (stat.wins + PRIOR_WINS) / (stat.games + PRIOR_GAMES);
    
    ops.push({
      updateOne: {
        filter: { playerId },
        update: {
          $set: {
            rank: stat.rank,
            // Keep decay_score for backward compatibility if needed, 
            // or we can set it to form_score too. 
            // User requested to keep decay_score compatible or transition.
            // Let's update decay_score to be consistent with form_score for now so old code works.
            decay_score: form_score, 
            form_score: form_score,
            form_asof: stat.lastDate,
            form_lambda: LAMBDA_DAILY
          }
        }
      }
    });
  }

  if (ops.length > 0) {
    console.log("💾 Executing bulkWrite...");
    // Split into chunks of 1000 to avoid BSON size limits if many players
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      const res = await Player.bulkWrite(chunk, { ordered: false });
      console.log(`   Chunk ${i / CHUNK_SIZE + 1}: matched ${res.nMatched}, modified ${res.nModified}`);
    }
  } else {
    console.log("ℹ️ No updates needed.");
  }

  await mongoose.connection.close();
  console.log("🏁 Update complete.");
}

// Run if called directly
const currentFile = url.fileURLToPath(import.meta.url);
const calledFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === calledFile) {
  updatePlayerStats();
}

export { updatePlayerStats };
