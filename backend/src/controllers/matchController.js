// src/controllers/matchController.js
import { Match } from "../models/Match.js";
import { Player } from "../models/Player.js";


export async function getAllMatches(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const keyword = req.query.player?.trim();

    const filter = keyword
      ? {
          $or: [
            { winnerName: new RegExp(keyword, "i") },
            { loserName: new RegExp(keyword, "i") },
          ],
        }
      : {};

    const total = await Match.countDocuments(filter);
    const matches = await Match.find(filter)
      .sort({ tourneyDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      total,
      page,
      pageSize: limit,
      matches,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMatchesByFilter(req, res, next) {
  try {
    const { name, year } = req.params;
    const filter = {};

    if (name) filter.tourneyName = new RegExp(name, "i");
    if (year) filter.year = Number(year);

    const matches = await Match.find(filter)
      .sort({ tourneyDate: -1 })
      .limit(50)
      .lean();

    res.json(matches);
  } catch (err) {
    next(err);
  }
}

export async function getHeadToHead(req, res, next) {
  try {
    const { player1, player2, surface, year } = req.query;

    if (!player1 || !player2) {
      return res.status(400).json({
        message: "Missing required query parameters: player1 and player2",
      });
    }

    const p1 = decodeURIComponent(player1.trim());
    const p2 = decodeURIComponent(player2.trim());

    const matchFilter = {
      $or: [
        { winnerName: p1, loserName: p2 },
        { winnerName: p2, loserName: p1 },
      ],
    };

    if (surface) {
      matchFilter.surface = new RegExp(surface, "i");
    }

    if (year) {
      matchFilter.tourneyDate = {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${Number(year) + 1}-01-01`),
      };
    }

    const matches = await Match.find(matchFilter)
      .sort({ tourneyDate: -1 })
      .limit(200)
      .lean();

    if (matches.length === 0) {
      return res.status(404).json({
        message: `No head-to-head matches found between ${p1} and ${p2}`,
      });
    }

    let p1Wins = 0;
    let p2Wins = 0;

    matches.forEach((m) => {
      if (m.winnerName === p1) p1Wins++;
      else if (m.winnerName === p2) p2Wins++;
    });

    const total = p1Wins + p2Wins;

    const summary = {
      player1: p1,
      player2: p2,
      totalMatches: total,
      [p1]: { wins: p1Wins, losses: p2Wins },
      [p2]: { wins: p2Wins, losses: p1Wins },
      winRate: {
        [p1]: total ? Number((p1Wins / total).toFixed(3)) : 0,
        [p2]: total ? Number((p2Wins / total).toFixed(3)) : 0,
      },
    };

    res.json({
      summary,
      filters: { surface: surface || "all", year: year || "all" },
      matches: matches.map((m) => ({
        tourneyName: m.tourneyName,
        surface: m.surface,
        round: m.round,
        score: m.score,
        date: m.tourneyDate,
        winner: m.winnerName,
        loser: m.loserName,
      })),
    });
  } catch (err) {
    next(err);
  }
}