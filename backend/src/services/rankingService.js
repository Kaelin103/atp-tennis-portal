// backend/src/services/rankingService.js
// Centralized dynamic scoring service to enable future ELO/K-factor and rankDiff bonuses.
import { Match } from "../models/Match.js";

/**
 * Compute dynamic score for players within a sliding window.
 * This service currently supports a "bonus" method that rewards wins over strong opponents.
 * It lays scaffolding for future ELO-style updates using K-factor and expected score.
 *
 * @param {Array} players - Array of player summary objects { name, winRate, total, wins, losses }
 * @param {Object} options - { baseMatch, method, bonusEnabled, kFactor }
 * @returns {Promise<Array>} players with `score` field added
 */
export async function computeDynamicScore(players, options = {}) {
  const {
    baseMatch = {},
    method = "bonus", // future: "elo"
    bonusEnabled = false,
    kFactor = 16, // reserved for ELO-style update
  } = options;

  if (!Array.isArray(players) || players.length === 0) return players || [];

  // Precompute name -> {winRate,total} map for quick lookups
  const nameStats = new Map(
    players.map((p) => [p.name, { winRate: Number(p.winRate || 0), total: Number(p.total || 0) }])
  );

  // Compute score baseline as winRate * 100 so that when sortBy=score but bonus off, values are still meaningful
  let withScore = players.map((p) => ({ ...p, score: Number((Number(p.winRate || 0) * 100).toFixed(2)) }));

  if (method === "bonus" && bonusEnabled) {
    // For players in the set, fetch their wins against opponents within the window
    const topNames = withScore.map((p) => p.name);
    const winsPairs = await Match.aggregate([
      { $match: baseMatch },
      { $match: { winnerName: { $in: topNames } } },
      { $project: { winnerName: 1, loserName: 1 } },
      { $group: { _id: "$winnerName", opponents: { $push: "$loserName" } } },
    ]);

    const oppMap = new Map(winsPairs.map((g) => [g._id, g.opponents || []]));

    withScore = withScore.map((p) => {
      const opponents = oppMap.get(p.name) || [];
      let bonusSum = 0;
      for (const opp of opponents) {
        const s = nameStats.get(opp);
        const oppRate = s ? Number(s.winRate || 0) : 0.5; // neutral baseline
        // Scale bonus by opponent strength above 0.5
        const perWinBonus = Math.max(0, (oppRate - 0.5) * 100) * 0.5;
        bonusSum += perWinBonus;
      }
      const bonusAvg = opponents.length ? bonusSum / opponents.length : 0;
      const score = Number(((Number(p.winRate || 0) * 100) + bonusAvg).toFixed(2));
      return { ...p, score };
    });
  }

  // TODO: method === "elo": implement rating updates per match using kFactor and expected score.
  // Placeholder to avoid breaking API shape; when enabled, it should iterate matches chronologically.

  return withScore;
}

function opponentStrengthWeight(rank) {
  const r = Number(rank || 0);
  if (r && r <= 5) return 1.5;
  if (r && r <= 10) return 1.3;
  if (r && r <= 20) return 1.2;
  if (r && r <= 50) return 1.1;
  if (r && r <= 100) return 1.0;
  return 0.8;
}

function eventLevelWeight(level) {
  const l = String(level || "").toUpperCase();
  if (l === "G") return 1.5;
  if (l === "GS") return 1.5;
  if (l === "M") return 1.3;
  if (l === "A") return 1.1;
  if (l === "B") return 1.0;
  return 0.8;
}

export async function computeWeightedScore(players, options = {}) {
  const { baseMatch = {}, limitOppRank = 500, rankingDate = new Date(), decayEnabled = false, lambda = 0.8 } = options;
  if (!Array.isArray(players) || players.length === 0) return players || [];
  const rankIndex = new Map(players.map((p, i) => [p.name, i + 1]));
  const names = players.map((p) => p.name);
  const matchFilter = { ...baseMatch, $or: [{ winnerName: { $in: names } }, { loserName: { $in: names } }] };
  const matches = await Match.find(matchFilter).select("winnerName loserName tourneyLevel tourneyDate").lean();
  const scoreSum = new Map();
  const weightSum = new Map();
  for (const m of matches) {
    const w = m.winnerName;
    const l = m.loserName;
    const lvlW = eventLevelWeight(m.tourneyLevel);
    const rankL = rankIndex.get(l) || limitOppRank + 1;
    const rankW = rankIndex.get(w) || limitOppRank + 1;
    const ow = opponentStrengthWeight(rankL);
    const ol = opponentStrengthWeight(rankW);
    const td = decayEnabled ? timeDecay(new Date(m.tourneyDate), new Date(rankingDate), lambda) : 1;
    const sw = 1 * ow * lvlW * td;
    const sl = 0 * ol * lvlW * td;
    scoreSum.set(w, Number(scoreSum.get(w) || 0) + sw);
    weightSum.set(w, Number(weightSum.get(w) || 0) + ow * lvlW * td);
    scoreSum.set(l, Number(scoreSum.get(l) || 0) + sl);
    weightSum.set(l, Number(weightSum.get(l) || 0) + ol * lvlW * td);
  }
  return players.map((p) => {
    const s = Number(scoreSum.get(p.name) || 0);
    const w = Number(weightSum.get(p.name) || 0);
    const weightedScore = w > 0 ? Number((s / w).toFixed(4)) : 0;
    return { ...p, weightedScore };
  });
}

function timeDecay(matchDate, rankingDate, lambda = 0.8) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysAgo = (rankingDate - matchDate) / msPerDay;
  return Math.exp(-lambda * (daysAgo / 365));
}

export async function computeEloRatings({ startDate, endDate, filter = {} }) {
  const INITIAL_RATING = 1500;
  const BASE_K = 32;
  const ratings = new Map();
  function getRating(id) {
    if (!ratings.has(id)) ratings.set(id, INITIAL_RATING);
    return ratings.get(id);
  }
  const query = { tourneyDate: { $gte: startDate, $lte: endDate }, ...filter };
  const matches = await Match.find(query)
    .sort({ tourneyDate: 1 })
    .select("winnerId loserId tourneyLevel tourneyDate")
    .lean();
  function currentRankFromRatings(pid) {
    const arr = Array.from(ratings.entries()).map(([id, r]) => ({ id, r }));
    arr.sort((a, b) => b.r - a.r);
    const idx = arr.findIndex((x) => Number(x.id) === Number(pid));
    return idx >= 0 ? idx + 1 : 501;
  }
  for (const m of matches) {
    const p1 = Number(m.winnerId);
    const p2 = Number(m.loserId);
    if (!p1 || !p2) continue;
    const r1 = getRating(p1);
    const r2 = getRating(p2);
    const expected1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const expected2 = 1 - expected1;
    const s1 = 1;
    const s2 = 0;
    const oppRank1 = currentRankFromRatings(p2);
    const oppRank2 = currentRankFromRatings(p1);
    const wOpp1 = opponentStrengthWeight(oppRank1);
    const wOpp2 = opponentStrengthWeight(oppRank2);
    const wEvt = eventLevelWeight(m.tourneyLevel);
    const k1 = BASE_K * wEvt * wOpp1;
    const k2 = BASE_K * wEvt * wOpp2;
    const newR1 = r1 + k1 * (s1 - expected1);
    const newR2 = r2 + k2 * (s2 - expected2);
    ratings.set(p1, newR1);
    ratings.set(p2, newR2);
  }
  const result = [];
  for (const [playerId, rating] of ratings.entries()) {
    result.push({ playerId, elo: rating });
  }
  return result;
}
