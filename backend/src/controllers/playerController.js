import { Match } from "../models/Match.js";
import { computeDynamicScore, computeWeightedScore } from "../services/rankingService.js";
import { Player } from "../models/Player.js";
import { getCountryIndex, resetCountryIndexCache } from "../utils/countryIndex.js";
// const { buildPredictionFeatures } = require("../utils/predictionFeatures"); 
// future extension: features can be derived from radar output

const cache = new Map();
const CACHE_TTL = (parseInt(process.env.CACHE_TTL_MINUTES, 10) || 5) * 60 * 1000;

function setCache(key, data) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}
 function getCache(key) {
  const c = cache.get(key);
  if (c && c.expiry > Date.now()) return c.data;
  cache.delete(key);
  return null;
}

// Normalize player names to improve matching between Match names and Player records
// - Lowercase
// - Remove accents/diacritics
// - Collapse extra spaces
// - Trim punctuation differences
function normalizeName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .normalize("NFD") // split accents
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "") // keep letters/spaces/basic separators
    .replace(/[\s'-]+/g, " ") // collapse separators to single space
    .trim();
}

async function getDatasetNow() {
  const cached = getCache("datasetNow");
  if (cached) return new Date(cached);

  const [row] = await Match.aggregate([
    { $group: { _id: null, maxDate: { $max: "$tourneyDate" } } },
  ]);
  
  // If no data, fallback to now. If data exists, use it.
  // Note: row.maxDate is expected to be a Date object based on schema.
  const maxDate = row?.maxDate || new Date();
  setCache("datasetNow", maxDate);
  return maxDate;
}

const smoothRate = (wins, total, alpha = 1, beta = 1) => {
  return (wins + alpha) / (total + alpha + beta);
};

export const getCompareRadar = async (req, res) => {
  try {
    const { aId, bId, aPid, bPid } = req.query; 
    const playerA = decodeURIComponent(aId || "").trim();
    const playerB = decodeURIComponent(bId || "").trim();
    
    // Check if we have IDs (preferred) or Names
    const useIds = (aPid && bPid);
    
    if (!useIds && (!playerA || !playerB)) {
      return res.status(400).json({ message: "aId/bId or aPid/bPid are required" });
    }

    // weeks <= 0 or missing => All-time (no cutoff)
    const weeks = Number(req.query.weeks ?? 0);
    const useWindow = weeks > 0;

    let surface = req.query.surface || "All";
    if (surface.toLowerCase() === "all") surface = "All";
    const decayEnabled = String(req.query.decay || "false").toLowerCase() === "true";
    const lambda = Number(req.query.lambda ?? 0.8);
    const minMatches = Number(req.query.minMatches || 5);
    const debug = String(req.query.debug || "false").toLowerCase() === "true";

    const datasetNow = await getDatasetNow();
    let cutoff = null;
    if (useWindow) {
      cutoff = new Date(datasetNow.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }

    // Common filter for all matches of a player
    const getBaseFilter = (pIdentifier) => {
      const f = useIds 
        ? { $or: [{ winnerId: Number(pIdentifier) }, { loserId: Number(pIdentifier) }] }
        : { $or: [{ winnerName: pIdentifier }, { loserName: pIdentifier }] };
      
      if (useWindow && cutoff) {
        f.tourneyDate = { $gte: cutoff };
      }
      return f;
    };

    const computeMetrics = async (identifier, nameForRegex) => {
      const filter = getBaseFilter(identifier);
      const allMatches = await Match.find(filter).sort({ tourneyDate: -1 }).lean();
      
      const totalMatches = allMatches.length;
      if (totalMatches === 0) {
        return { values: [0,0,0,0,0,0], meta: { matches: 0 }, components: {} };
      }

      const isWinner = (m) => useIds ? m.winnerId === Number(identifier) : m.winnerName === identifier;

      // Helper for time decay
      const getTimeDecay = (date) => {
        if (!decayEnabled) return 1;
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysAgo = (datasetNow - date) / msPerDay;
        // Avoid future dates causing issues
        if (daysAgo < 0) return 1; 
        return Math.exp(-lambda * (daysAgo / 365));
      };

      // Metric 1: WinRate
      const wins = allMatches.filter(isWinner).length;
      const winRate = totalMatches ? wins / totalMatches : 0;
      const winRateSmoothed = smoothRate(wins, totalMatches);

      // Metric 2: RecentForm (Last 10 matches)
      const recent = allMatches.slice(0, 10);
      const recentWins = recent.filter(isWinner).length;
      const recentForm = recent.length ? recentWins / recent.length : 0;
      const recentFormSmoothed = smoothRate(recentWins, recent.length);

      // Metric 3: SurfaceWR
      let surfaceWR = 0;
      let surfaceWRSmoothed = 0;
      let surfWins = 0;
      let surfTotal = 0;
      if (surface === "All") {
        surfaceWR = winRate;
        surfaceWRSmoothed = winRateSmoothed;
        surfWins = wins;
        surfTotal = totalMatches;
      } else {
        const surfaceMatches = allMatches.filter(m => m.surface === surface);
        surfWins = surfaceMatches.filter(isWinner).length;
        surfTotal = surfaceMatches.length;
        surfaceWR = surfTotal ? surfWins / surfTotal : 0;
        surfaceWRSmoothed = smoothRate(surfWins, surfTotal);
      }

      // Metric 4: VsStrong (Tourney Level G, M, F)
      const strongLevels = ["G", "M", "F"];
      const strongMatches = allMatches.filter(m => strongLevels.includes(m.tourneyLevel));
      const strongWins = strongMatches.filter(isWinner).length;
      const strongTotal = strongMatches.length;
      const vsStrong = strongTotal ? strongWins / strongTotal : 0;
      const vsStrongSmoothed = smoothRate(strongWins, strongTotal);

      // Metric 5: Activity
      const activityDenominator = useWindow ? (weeks * 1.5) : 100;
      const activity = Math.min(totalMatches / activityDenominator, 1);

      // Metric 6: Weighted (Time-Decayed Win Rate)
      // If decay=false, this equals WinRate.
      let wSum = 0;
      let wTotal = 0;
      for (const m of allMatches) {
        const weight = getTimeDecay(m.tourneyDate);
        if (isWinner(m)) {
          wSum += weight;
        }
        wTotal += weight;
      }
      // Apply smoothing to weighted values too: (wSum + alpha) / (wTotal + alpha + beta)
      const weighted = smoothRate(wSum, wTotal);

      const components = {
        WinRate: { wins, total: totalMatches, raw: winRate, smoothed: winRateSmoothed },
        RecentForm: { wins: recentWins, total: recent.length, raw: recentForm, smoothed: recentFormSmoothed },
        SurfaceWR: { wins: surfWins, total: surfTotal, raw: surfaceWR, smoothed: surfaceWRSmoothed },
        VsStrong: { wins: strongWins, total: strongTotal, raw: vsStrong, smoothed: vsStrongSmoothed },
        Activity: { total: totalMatches, denominator: activityDenominator, raw: activity },
        Weighted: { raw: weighted, wSum, wTotal }
      };

      return {
        name: useIds ? (allMatches[0].winnerId === Number(identifier) ? allMatches[0].winnerName : allMatches[0].loserName) : identifier,
        values: [winRateSmoothed, recentFormSmoothed, surfaceWRSmoothed, vsStrongSmoothed, activity, weighted],
        meta: { matches: totalMatches },
        components
      };
    };

    const statsA = await computeMetrics(useIds ? aPid : playerA, playerA);
    const statsB = await computeMetrics(useIds ? bPid : playerB, playerB);

    // Calculate Distance (L2)
    const distL2 = Math.sqrt(
      statsA.values.reduce((sum, v, i) => sum + Math.pow(v - statsB.values[i], 2), 0)
    );

    const response = {
      meta: { 
        weeks, 
        surface, 
        decay: decayEnabled, 
        lambda, 
        bonus: false, 
        minMatches,
        cutoffDate: cutoff,
        aPid: useIds ? aPid : null,
        bPid: useIds ? bPid : null,
        aMatchesUsed: statsA.meta.matches,
        bMatchesUsed: statsB.meta.matches,
        recentFormN: 10,
        strongRule: "GS/M/F",
        distance: Number(distL2.toFixed(4))
      },
      labels: ["WinRate", "RecentForm", "SurfaceWR", "VsStrong", "Activity", "Weighted"],
      a: {
        name: statsA.name,
        values: statsA.values
      },
      b: {
        name: statsB.name,
        values: statsB.values
      }
    };

    if (debug) {
      response.components = {
        a: statsA.components,
        b: statsB.components
      };
    }

    res.json(response);

  } catch (err) {
    console.error("❌ getCompareRadar error:", err);
    res.status(500).json({ message: "Failed to fetch comparison radar", error: err.message });
  }
};

export const getRankings = async (req, res) => {
  try {
    const { year, surface } = req.query;
    const limit = Number(req.query.limit) || 20;
    const minMatches = Number(req.query.minMatches) || 10;
    const algo = String(req.query.algo || "classic");
    const bonusEnabled = String(req.query.bonus || "false").toLowerCase() === "true";
    const sortBy = String(req.query.sortBy || "winRate");

    const cacheKey = `rank:${year || "all"}:${surface || "all"}:${minMatches}:${limit}:${algo}:${bonusEnabled}:${sortBy}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const baseMatch = {};
    if (surface && surface !== "all") baseMatch.surface = surface;

    const pipeline = [];
    if (Object.keys(baseMatch).length) pipeline.push({ $match: baseMatch });

    if (year && year !== "all") {
      const y = Number(year);
      pipeline.push({
        $match: {
          $expr: {
            $or: [
              { $eq: ["$year", y] },
              {
                $and: [
                  { $eq: [{ $type: "$tourneyDate" }, "date"] },
                  { $eq: [{ $year: "$tourneyDate" }, y] },
                ],
              },
              {
                $eq: [
                  {
                    $toInt: {
                      $substrBytes: [{ $toString: "$tourneyDate" }, 0, 4],
                    },
                  },
                  y,
                ],
              },
            ],
          },
        },
      });
    }

    pipeline.push(
      {
        $facet: {
          wins: [{ $group: { _id: "$winnerName", wins: { $sum: 1 } } }],
          losses: [{ $group: { _id: "$loserName", losses: { $sum: 1 } } }],
        },
      },
      { $project: { merged: { $concatArrays: ["$wins", "$losses"] } } },
      { $unwind: "$merged" },
      {
        $group: {
          _id: "$merged._id",
          wins: { $sum: "$merged.wins" },
          losses: { $sum: "$merged.losses" },
        },
      },
      {
        $addFields: {
          wins: { $ifNull: ["$wins", 0] },
          losses: { $ifNull: ["$losses", 0] },
          total: {
            $add: [{ $ifNull: ["$wins", 0] }, { $ifNull: ["$losses", 0] }],
          },
        },
      },
      { $match: { total: { $gte: minMatches } } },
      {
        $addFields: {
          winRate: {
            $cond: [{ $eq: ["$total", 0] }, 0, { $divide: ["$wins", "$total"] }],
          },
        },
      },
      { $sort: { winRate: -1, wins: -1, total: -1, _id: 1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          name: "$_id",
          wins: 1,
          losses: 1,
          total: 1,
          winRate: { $round: ["$winRate", 4] },
        },
      }
    );

    // Branch: Elo algorithm for all seasons or filtered year/surface
    if (algo === "elo") {
      const startDate = year && year !== "all" ? new Date(Number(year), 0, 1) : new Date(1968, 0, 1);
      const endDate = year && year !== "all" ? new Date(Number(year), 11, 31, 23, 59, 59) : new Date();
      const { computeEloRatings } = await import("../services/rankingService.js");
      const filter = {};
      if (surface && surface !== "all") filter.surface = surface;
      const eloRows = await computeEloRatings({ startDate, endDate, filter });
      const playerIds = eloRows.map((r) => Number(r.playerId)).filter(Boolean);
      const playersInfo = await Player.find({ playerId: { $in: playerIds } }).lean();
      const countryIndex = await getCountryIndex();
      const nameById = new Map(playersInfo.map((p) => [Number(p.playerId), `${p.firstName} ${p.lastName}`]));
      const countryById = new Map(
        playersInfo.map((p) => {
          const name = `${p.firstName} ${p.lastName}`;
          const derived = p.countryCode || countryIndex.get(normalizeName(name)) || "UNK";
          return [Number(p.playerId), derived];
        })
      );

      let playersOut = eloRows.map((r) => ({
        name: nameById.get(Number(r.playerId)) || String(r.playerId),
        countryCode: countryById.get(Number(r.playerId)) || "UNK",
        elo: Number(r.elo || 0),
      }));
      playersOut.sort((a, b) => Number(b.elo || 0) - Number(a.elo || 0) || a.name.localeCompare(b.name));
      playersOut = playersOut.map((p, i) => ({ ...p, rank: i + 1 }));
      const payload = { players: playersOut };
      setCache(cacheKey, payload);
      return res.json(payload);
    }

    const ranking = await Match.aggregate(pipeline);
    const countryIndex = await getCountryIndex();

    let playersOut = ranking.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      countryCode: countryIndex.get(normalizeName(r.name)) || "UNK",
      wins: r.wins,
      losses: r.losses,
      total: r.total,
      winRate: r.winRate,
    }));

    const baseMatchWeighted = {};
    if (surface && surface !== "all") baseMatchWeighted.surface = surface;
    if (year && year !== "all") {
      const y = Number(year);
      baseMatchWeighted.$expr = {
        $or: [
          {
            $and: [
              { $eq: [{ $type: "$tourneyDate" }, "date"] },
              { $eq: [{ $year: "$tourneyDate" }, y] },
            ],
          },
          {
            $eq: [
              {
                $toInt: {
                  $substrBytes: [{ $toString: "$tourneyDate" }, 0, 4],
                },
              },
              y,
            ],
          },
        ],
      };
    }

    playersOut = await computeDynamicScore(playersOut, { baseMatch, method: "bonus", bonusEnabled });
    playersOut = await computeWeightedScore(playersOut, { baseMatch: baseMatchWeighted, rankingDate: new Date() });

    if (sortBy === "score") {
      playersOut.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.wins ?? 0) - (a.wins ?? 0) || (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name));
      playersOut = playersOut.map((p, i) => ({ ...p, rank: i + 1 }));
    } else if (sortBy === "weighted") {
      playersOut.sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0) || (b.wins ?? 0) - (a.wins ?? 0) || (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name));
      playersOut = playersOut.map((p, i) => ({ ...p, rank: i + 1 }));
    }

    const payload = { players: playersOut };
    setCache(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("❌ getRankings error:", err);
    res.status(500).json({ message: "Failed to fetch rankings", error: err.message });
  }
};

export const getPlayerTimeline = async (req, res) => {
  try {
      let playerId = req.params.id;
      // If it looks like a number, treat as ID
      const isId = !isNaN(Number(playerId));
      if (isId) playerId = Number(playerId);
      else playerId = decodeURIComponent(playerId).trim();

      const startYear = Number(req.query.startYear) || 1968;
      const endYear = Number(req.query.endYear) || new Date().getFullYear();

      const filter = isId 
          ? { $or: [{ winnerId: playerId }, { loserId: playerId }] }
          : { $or: [{ winnerName: playerId }, { loserName: playerId }] };
      
      const matches = await Match.find(filter)
          .select("tourneyDate winnerId loserId winnerName loserName winnerRankPoints loserRankPoints")
          .sort({ tourneyDate: 1 })
          .lean();

      if (!matches.length) {
          return res.json({ playerId, name: playerId, timeline: [], meta: {} });
      }
      
      const playerName = isId 
          ? (matches[0].winnerId === playerId ? matches[0].winnerName : matches[0].loserName)
          : playerId;

      const yearsMap = new Map();
      
      for (const m of matches) {
          if (!m.tourneyDate) continue;
          const y = new Date(m.tourneyDate).getFullYear();
          if (y < startYear || y > endYear) continue;
          
          if (!yearsMap.has(y)) yearsMap.set(y, []);
          yearsMap.get(y).push(m);
      }

      const timeline = [];
      const lambda = 0.8; 

      for (const [year, yearMatches] of yearsMap.entries()) {
           // 1. Win Rate
           const wins = yearMatches.filter(m => isId ? m.winnerId === playerId : m.winnerName === playerName).length;
           const total = yearMatches.length;
           const winRate = total ? wins / total : 0;

           // 2. Weighted (Slice to year, Decay relative to year end)
           const yearEnd = new Date(year, 11, 31);
           let wSum = 0;
           let wTotal = 0;
           
           for (const m of yearMatches) {
               const msPerDay = 24 * 60 * 60 * 1000;
               const daysAgo = (yearEnd - new Date(m.tourneyDate)) / msPerDay;
               const d = Math.max(0, daysAgo);
               
               const weight = Math.exp(-lambda * (d / 365));
               
               if (isId ? m.winnerId === playerId : m.winnerName === playerName) {
                   wSum += weight;
               }
               wTotal += weight;
           }
           const weighted = smoothRate(wSum, wTotal);

           // 3. Elo (Year End) - using Rank Points as proxy
           const lastMatch = yearMatches[yearMatches.length - 1];
           let elo = null;
           if (isId ? lastMatch.winnerId === playerId : lastMatch.winnerName === playerName) {
               elo = lastMatch.winnerRankPoints;
           } else {
               elo = lastMatch.loserRankPoints;
           }
           
           timeline.push({
               year,
               winRate: Number(winRate.toFixed(3)),
               weighted: Number(weighted.toFixed(3)),
               elo: elo || null
           });
      }
      
      timeline.sort((a, b) => a.year - b.year);

      res.json({
          playerId,
          name: playerName,
          timeline,
          meta: {
              startYear,
              endYear,
              eloStrategy: "year_end_rank_points",
              weightedStrategy: "year_slice_decay_to_yearend",
              winRateStrategy: "wins_over_total"
          }
      });

  } catch (err) {
      console.error("❌ getPlayerTimeline error:", err);
      res.status(500).json({ message: "Failed to fetch timeline", error: err.message });
  }
};

// Dynamic rankings over a sliding window (default: last 500 days)
// GET /api/players/rankings/dynamic?days=500&surface=clay&limit=20&minMatches=10
export const getDynamicRankings = async (req, res) => {
  try {
    // Cause 4: Handle "window=52w" from frontend
    let weeksInput = req.query.weeks;
    if (req.query.window === "52w") {
      weeksInput = 52;
    }

    // Support week-based windows while keeping days-compatible behavior
    const weeksParam = weeksInput != null ? Number(weeksInput) : null;
    const daysParam = req.query.days != null ? Number(req.query.days) : null;
    const days = Number(weeksParam ? weeksParam * 7 : (daysParam || 500));

    // Cause 1: Use dataset max date instead of system time
    const datasetNow = await getDatasetNow();
    const cutoff = new Date(datasetNow.getTime() - days * 24 * 60 * 60 * 1000);

    const { surface } = req.query;
    const limit = Number(req.query.limit) || 20;
    // Cause 2: Lower default minMatches from 10 to 2
    const minMatches = Number(req.query.minMatches) || 2;
    const bonusEnabled = String(req.query.bonus || "false").toLowerCase() === "true";
    const sortBy = String(req.query.sortBy || "winRate");
    const algo = String(req.query.algo || "classic");
    const decayEnabled = String(req.query.decay || "false").toLowerCase() === "true";
    const lambda = Number(req.query.lambda ?? 0.8);

    const cacheKey = `rank:dynamic:${days}:${surface || "all"}:${minMatches}:${limit}:${algo}:${bonusEnabled}:${sortBy}:${datasetNow.getTime()}:${decayEnabled}:${lambda}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const baseMatch = {
      $or: [
        // direct Date comparison
        { tourneyDate: { $gte: cutoff, $lte: datasetNow } },
        // fallback on year field for non-date values (though we prefer Date)
        { year: { $gte: cutoff.getFullYear() } },
      ],
    };
    if (surface && surface !== "all") baseMatch.surface = surface;

    const pipeline = [{ $match: baseMatch }];

    pipeline.push(
      {
        $facet: {
          wins: [{ $group: { _id: "$winnerName", wins: { $sum: 1 } } }],
          losses: [{ $group: { _id: "$loserName", losses: { $sum: 1 } } }],
        },
      },
      { $project: { merged: { $concatArrays: ["$wins", "$losses"] } } },
      { $unwind: "$merged" },
      {
        $group: {
          _id: "$merged._id",
          wins: { $sum: "$merged.wins" },
          losses: { $sum: "$merged.losses" },
        },
      },
      {
        $addFields: {
          wins: { $ifNull: ["$wins", 0] },
          losses: { $ifNull: ["$losses", 0] },
          total: { $add: [{ $ifNull: ["$wins", 0] }, { $ifNull: ["$losses", 0] }] },
        },
      },
      { $match: { total: { $gte: minMatches } } },
      {
        $addFields: {
          winRate: {
            $cond: [{ $eq: ["$total", 0] }, 0, { $divide: ["$wins", "$total"] }],
          },
        },
      },
      { $sort: { winRate: -1, wins: -1, total: -1, _id: 1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          name: "$_id",
          wins: 1,
          losses: 1,
          total: 1,
          winRate: { $round: ["$winRate", 4] },
        },
      }
    );

    const ranking = await Match.aggregate(pipeline);
    const countryIndex = await getCountryIndex();

    let playersOut = ranking.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      countryCode: countryIndex.get(normalizeName(r.name)) || "UNK",
      wins: r.wins,
      losses: r.losses,
      total: r.total,
      winRate: r.winRate,
      windowDays: days,
      windowWeeks: weeksParam || null,
      cutoffDate: cutoff,
    }));

    if (algo === "elo") {
      const endDate = new Date();
      const { computeEloRatings } = await import("../services/rankingService.js");
      const eloRows = await computeEloRatings({ startDate: cutoff, endDate });
      const playerIds = eloRows.map((r) => Number(r.playerId)).filter(Boolean);
      const playersInfo = await Player.find({ playerId: { $in: playerIds } }).lean();
      const nameById = new Map(playersInfo.map((p) => [Number(p.playerId), `${p.firstName} ${p.lastName}`]));
      const countryIndex = await getCountryIndex();
      const countryById = new Map(
        playersInfo.map((p) => {
          const name = `${p.firstName} ${p.lastName}`;
          const derived = p.countryCode || countryIndex.get(normalizeName(name)) || "UNK";
          return [Number(p.playerId), derived];
        })
      );
      playersOut = eloRows.map((r) => ({
        name: nameById.get(Number(r.playerId)) || String(r.playerId),
        countryCode: countryById.get(Number(r.playerId)) || "UNK",
        elo: Number(r.elo || 0),
        windowDays: days,
        windowWeeks: weeksParam || null,
        cutoffDate: cutoff,
      }));
      playersOut.sort((a, b) => Number(b.elo || 0) - Number(a.elo || 0) || a.name.localeCompare(b.name));
      playersOut = playersOut.map((p, i) => ({ ...p, rank: i + 1 }));
    } else {
      if (playersOut.length) {
        playersOut = await computeDynamicScore(playersOut, { baseMatch, method: "bonus", bonusEnabled });
        playersOut = await computeWeightedScore(playersOut, { baseMatch, rankingDate: cutoff, decayEnabled, lambda });
        if (sortBy === "score") {
          playersOut.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.wins ?? 0) - (a.wins ?? 0) || (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name));
        }
        if (sortBy === "weighted") {
          playersOut.sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0) || (b.wins ?? 0) - (a.wins ?? 0) || (b.total ?? 0) - (a.total ?? 0) || a.name.localeCompare(b.name));
          playersOut = playersOut.map((p, i) => ({ ...p, rank: i + 1 }));
        }
      }
    }

    const payload = {
      players: playersOut,
      meta: {
        windowDays: days,
        windowWeeks: weeksParam || null,
        surface: surface || "all",
        bonus: bonusEnabled,
        sortBy,
        algo,
        decay: decayEnabled,
        lambda,
      },
    };
    setCache(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error("❌ getDynamicRankings error:", err);
    res.status(500).json({ message: "Failed to fetch dynamic rankings", error: err.message });
  }
};

export const getPlayerStats = async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.name).trim();
    const player = await Player.findOne({
      $or: [
        { firstName: new RegExp(playerName, "i") },
        { lastName: new RegExp(playerName, "i") },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: playerName,
              options: "i",
            },
          },
        },
      ],
    });

    if (!player) return res.status(404).json({ message: "Player not found" });

    const matches = await Match.find({
      $or: [
        { winnerName: new RegExp(playerName, "i") },
        { loserName: new RegExp(playerName, "i") },
      ],
    }).sort({ tourneyDate: -1 });

    const wins = matches.filter((m) => new RegExp(playerName, "i").test(m.winnerName)).length;
    const losses = matches.length - wins;
    const total = matches.length;
    const winRate = total ? wins / total : 0;

    const allPlayers = await Match.aggregate([
      { $group: { _id: "$winnerName", wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
    ]);

    const rankIndex = allPlayers.findIndex((p) =>
      p._id?.toLowerCase()?.includes(playerName.toLowerCase())
    );
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    const recentMatches = matches.slice(0, 10);

    // derive country via normalized index if missing
    const countryIndex = await getCountryIndex();
    const derivedCountry = countryIndex.get(normalizeName(`${player.firstName} ${player.lastName}`)) || player.countryCode || "";

    res.json({
      player: {
        playerId: player.playerId,
        name: `${player.firstName} ${player.lastName}`,
        country: derivedCountry,
        rank: rank || "N/A",
      },
      stats: { wins, losses, total, winRate },
      recentMatches,
    });
  } catch (err) {
    console.error("❌ getPlayerStats failed:", err);
    res.status(500).json({ message: "Server error fetching player stats" });
  }
};

export const getPlayerById = async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    if (Number.isNaN(playerId))
      return res.status(400).json({ message: "Invalid player ID" });

    const player = await Player.findOne({ playerId }).lean();
    if (!player) return res.status(404).json({ message: "Player not found" });

    res.json({
      playerId: player.playerId,
      name: `${player.firstName} ${player.lastName}`,
      country: player.countryCode,
      hand: player.hand,
      birthDate: player.birthDate,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getHeadToHeadByName = async (req, res) => {
  try {
    const { player1, player2 } = req.query;
    if (!player1 || !player2)
      return res.status(400).json({ message: "player1 and player2 are required" });

    const matches = await Match.find({
      $or: [
        { winnerName: player1, loserName: player2 },
        { winnerName: player2, loserName: player1 },
      ],
    })
      .sort({ tourneyDate: -1 })
      .select("tourneyName tourneyDate surface winnerName loserName score")
      .lean();

    const wins = matches.filter((m) => m.winnerName === player1).length;
    const losses = matches.filter((m) => m.winnerName === player2).length;
    const total = matches.length;
    const winRate = total ? wins / total : 0;

    // Compute current streak (most recent consecutive wins by the same player)
    let streakLength = 0;
    let streakPlayer = null;
    for (const m of matches) {
      if (!streakPlayer) {
        streakPlayer = m.winnerName;
        streakLength = 1;
      } else if (m.winnerName === streakPlayer) {
        streakLength += 1;
      } else {
        break;
      }
    }
    const streak = { player: streakPlayer, length: streakLength };

    // Recent trend from player1 perspective over last 10 matches
    const recent = matches.slice(0, 10);
    const recentSeq = recent.map((m) => (m.winnerName === player1 ? "W" : "L"));
    const recentTrend = {
      sequence: recentSeq.join(""),
      wins: recentSeq.filter((x) => x === "W").length,
      losses: recentSeq.filter((x) => x === "L").length,
      window: recent.length,
    };

    res.json({ player1, player2, wins, losses, total, winRate, streak, recentTrend, matches });
  } catch (err) {
    console.error("❌ getHeadToHeadByName error:", err);
    res.status(500).json({ message: "Server error in getHeadToHeadByName" });
  }
};

export const getHeadToHeadSummary = async (req, res) => {
  try {
    const summary = await Match.aggregate([
      { $match: { winnerName: { $ne: null }, loserName: { $ne: null } } },
      {
        $group: {
          _id: {
            pair: {
              $cond: [
                { $lt: ["$winnerName", "$loserName"] },
                ["$winnerName", "$loserName"],
                ["$loserName", "$winnerName"],
              ],
            },
          },
          matches: { $sum: 1 },
        },
      },
      { $sort: { matches: -1 } },
      { $limit: 100 },
      {
        $project: {
          _id: 0,
          player1: { $arrayElemAt: ["$_id.pair", 0] },
          player2: { $arrayElemAt: ["$_id.pair", 1] },
          matches: 1,
          score: { $concat: [{ $toString: "$matches" }, " matches"] },
        },
      },
    ]);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ message: "Server error in getHeadToHeadSummary" });
  }
};

export const getTopHeadToHead = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Match.aggregate([
      { $match: { winnerName: { $ne: null }, loserName: { $ne: null } } },
      {
        $group: {
          _id: {
            pair: {
              $cond: [
                { $lt: ["$winnerName", "$loserName"] },
                ["$winnerName", "$loserName"],
                ["$loserName", "$winnerName"],
              ],
            },
          },
          matches: { $sum: 1 },
          // Capture one document to extract IDs and Names safely
          sample: { $first: "$$ROOT" }
        },
      },
      { $sort: { matches: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          player1: { $arrayElemAt: ["$_id.pair", 0] },
          player2: { $arrayElemAt: ["$_id.pair", 1] },
          // Try to map IDs to the names we grouped by.
          // Since we grouped by Name, we can find which name corresponds to which ID in the sample.
          player1Id: {
            $cond: [
              { $eq: ["$sample.winnerName", { $arrayElemAt: ["$_id.pair", 0] }] },
              "$sample.winnerId",
              "$sample.loserId"
            ]
          },
          player2Id: {
            $cond: [
              { $eq: ["$sample.winnerName", { $arrayElemAt: ["$_id.pair", 1] }] },
              "$sample.winnerId",
              "$sample.loserId"
            ]
          },
          matches: 1,
          score: { $concat: [{ $toString: "$matches" }, " matches"] },
        },
      },
    ]);
    res.json({ top: data });
  } catch (err) {
    res.status(500).json({ message: "Server error in getTopHeadToHead" });
  }
};

export const getSurfaceStats = async (req, res) => {
  try {
    const surfaces = await Match.aggregate([
      { $match: { winnerName: { $ne: null } } },
      {
        $group: {
          _id: { $ifNull: ["$surface", "Unknown"] },
          matches: { $sum: 1 },
          uniqueWinners: { $addToSet: "$winnerName" },
        },
      },
      {
        $project: {
          _id: 0,
          surface: "$_id",
          matches: 1,
          uniqueWinners: { $size: "$uniqueWinners" },
        },
      },
      { $sort: { matches: -1 } },
    ]);
    res.json({ stats: surfaces });
  } catch (err) {
    res.status(500).json({ message: "Server error in getSurfaceStats" });
  }
};

// Yearly trend by surface: /players/surfaces/yearly
export const getSurfaceYearlyStats = async (req, res) => {
  try {
    const start = Number(req.query.start) || null;
    const end = Number(req.query.end) || null;

    const pipeline = [];

    // compute normalized year from possibly mixed tourneyDate types
    pipeline.push({
      $addFields: {
        year: {
          $cond: [
            { $eq: [{ $type: "$tourneyDate" }, "date"] },
            { $year: "$tourneyDate" },
            {
              $toInt: {
                $substrBytes: [{ $toString: "$tourneyDate" }, 0, 4],
              },
            },
          ],
        },
      },
    });

    if (start || end) {
      const matchYear = {};
      if (start) matchYear.$gte = start;
      if (end) matchYear.$lte = end;
      pipeline.push({ $match: { year: matchYear } });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            surface: { $ifNull: ["$surface", "Unknown"] },
            year: "$year",
          },
          matches: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          surface: "$_id.surface",
          year: "$_id.year",
          matches: 1,
        },
      },
      { $sort: { surface: 1, year: 1 } }
    );

    const rows = await Match.aggregate(pipeline);

    // group into map: { Hard: [{year, matches}], ... }
    const grouped = rows.reduce((acc, r) => {
      if (!acc[r.surface]) acc[r.surface] = [];
      acc[r.surface].push({ year: r.year, matches: r.matches });
      return acc;
    }, {});

    res.json({ yearly: grouped });
  } catch (err) {
    console.error("❌ getSurfaceYearlyStats error:", err);
    res.status(500).json({ message: "Server error in getSurfaceYearlyStats" });
  }
};

// Tournament level distribution by surface: /players/surfaces/levels
export const getSurfaceLevelStats = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: {
            surface: { $ifNull: ["$surface", "Unknown"] },
            level: { $ifNull: ["$tourneyLevel", "Unknown"] },
          },
          matches: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          surface: "$_id.surface",
          level: "$_id.level",
          matches: 1,
        },
      },
      { $sort: { surface: 1, matches: -1 } },
    ];

    const rows = await Match.aggregate(pipeline);

    // group into { surface: [{ level, matches }] }
    const grouped = rows.reduce((acc, r) => {
      if (!acc[r.surface]) acc[r.surface] = [];
      acc[r.surface].push({ level: r.level, matches: r.matches });
      return acc;
    }, {});

    res.json({ levels: grouped });
  } catch (err) {
    console.error("❌ getSurfaceLevelStats error:", err);
    res.status(500).json({ message: "Server error in getSurfaceLevelStats" });
  }
};

export const searchPlayers = async (req, res) => {
  try {
    const { name } = req.query;
    const regex = new RegExp(name || "", "i");
    const players = await Player.find({ $or: [{ firstName: regex }, { lastName: regex }] })
      .limit(50)
      .lean();
    res.json(players);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const clearCache = async (req, res) => {
  cache.clear();
  res.json({ message: "Cache cleared successfully." });
};

console.log(`✅ playerController fully loaded. Cache TTL = ${CACHE_TTL / 60000} min`);

// Debug helper: lookup country by player name against the country index
export const lookupCountry = async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) return res.status(400).json({ message: "Missing ?name" });
    const index = await getCountryIndex();
    const key = normalizeName(name);
    const code = index.get(key) || null;
    res.json({ name, normalizedKey: key, code, indexSize: index.size });
  } catch (err) {
    console.error("❌ lookupCountry error:", err);
    res.status(500).json({ message: "Server error in lookupCountry" });
  }
};

// Admin/debug: clear country index cache to force reload
export const clearCountryIndex = async (req, res) => {
  try {
    resetCountryIndexCache();
    res.json({ message: "Country index cache cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear country index cache" });
  }
};
