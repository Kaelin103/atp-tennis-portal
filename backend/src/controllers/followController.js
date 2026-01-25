import { Follow } from "../models/Follow.js";
import { FollowLog } from "../models/FollowLog.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";

export const followPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const userId = req.user.id;
    const { name, country } = req.body || {};

    if (!playerId) return res.status(400).json({ message: "Missing playerId" });

    const exists = await Follow.findOne({ userId, playerId });
    if (exists) return res.status(409).json({ message: "Already following this player" });

    let player = null;
    if (/^[0-9a-fA-F]{24}$/.test(playerId)) {
      player = await Player.findById(playerId).lean();
    }
    if (!player) {
      player = await Player.findOne({
        $or: [{ playerId: Number(playerId) }, { playerId }],
      }).lean();
    }

    if (!player && name) {
      const [firstName, ...rest] = name.split(" ");
      const lastName = rest.join(" ") || "";
      const flagUrl = country ? `https://flagcdn.com/64x48/${country.toLowerCase()}.png` : null;
      const randomAvatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`;
      const avatarUrl = flagUrl || randomAvatar;
      const newPlayer = await Player.create({
        firstName,
        lastName,
        playerId: Number(playerId) || Math.floor(Math.random() * 999999),
        countryCode: country || "UNK",
        imageUrl: avatarUrl,
        hand: "R",
      });
      player = newPlayer.toObject();
    }

    if (!player)
      return res.status(404).json({ message: "Player not found and could not be created" });

    const follow = await Follow.create({
      userId,
      playerId: player.playerId || player._id || playerId,
      playerName: `${player.firstName || ""} ${player.lastName || ""}`.trim(),
      country: player.countryCode || country || "UNK",
      imageUrl:
        player.imageUrl ||
        `https://flagcdn.com/64x48/${(player.countryCode || "unk").toLowerCase()}.png`,
    });

    // Audit log: follow
    try {
      await FollowLog.create({
        userId,
        playerId: follow.playerId,
        playerName: follow.playerName,
        country: follow.country,
        action: "follow",
      });
    } catch (e) {
      console.warn("⚠️ [FollowLog] failed to record follow:", e?.message);
    }

    const displayName = `${player.firstName || ""} ${player.lastName || ""}`.trim();

    return res.status(201).json({
      message: `Successfully followed ${displayName}`,
      follow: {
        id: follow._id,
        player: {
          id: player.playerId?.toString() || player._id?.toString(),
          name: displayName,
          country: player.countryCode || country || "N/A",
          imageUrl: follow.imageUrl,
        },
      },
    });
  } catch (err) {
    console.error("❌ followPlayer error:", err);
    return res.status(500).json({ message: "Failed to follow player", error: err.message });
  }
};

export const unfollowPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const userId = req.user.id;

    if (!playerId) return res.status(400).json({ message: "Missing playerId" });

    // Build candidate values to match Mixed type robustly
    const candidates = new Set([playerId]);
    // Numeric id
    const num = Number(playerId);
    if (!Number.isNaN(num)) candidates.add(num);
    // Mongo ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(playerId)) {
      try {
        const oid = (await import("mongoose")).default.Types.ObjectId.createFromHexString(playerId);
        candidates.add(oid);
      } catch {}
    }

    // Try find by playerId variations to capture details for logging
    const target = await Follow.findOne({ userId, playerId: { $in: Array.from(candidates) } }).lean();
    // Try delete by playerId variations
    let result = await Follow.deleteOne({ userId, playerId: { $in: Array.from(candidates) } });

    // Fallback: allow deleting by Follow document _id in case client passed it
    if (result.deletedCount === 0 && /^[0-9a-fA-F]{24}$/.test(playerId)) {
      try {
        const oid = (await import("mongoose")).default.Types.ObjectId.createFromHexString(playerId);
        const doc = await Follow.findOne({ userId, _id: oid }).lean();
        result = await Follow.deleteOne({ userId, _id: oid });
        if (!target && doc) {
          // capture fallback doc for logging
          try {
            await FollowLog.create({
              userId,
              playerId: doc.playerId,
              playerName: doc.playerName,
              country: doc.country,
              action: "unfollow",
            });
          } catch (e) {
            console.warn("⚠️ [FollowLog] failed to record unfollow (fallback):", e?.message);
          }
        }
      } catch {}
    }

    if (result.deletedCount === 0)
      return res.status(404).json({ message: "Follow record not found" });

    // Audit log: unfollow for the primary match path
    if (target) {
      try {
        await FollowLog.create({
          userId,
          playerId: target.playerId,
          playerName: target.playerName,
          country: target.country,
          action: "unfollow",
        });
      } catch (e) {
        console.warn("⚠️ [FollowLog] failed to record unfollow:", e?.message);
      }
    }
    return res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    console.error("❌ unfollowPlayer error:", err);
    return res.status(500).json({ message: "Failed to unfollow player", error: err.message });
  }
};

export const getFollows = async (req, res) => {
  try {
    const userId = req.user.id;
    const follows = await Follow.find({ userId }).sort({ createdAt: -1 }).lean();
    if (follows.length === 0) return res.json({ count: 0, follows: [] });

    const followedNames = follows
      .map((f) => f.playerName)
      .filter((n) => typeof n === "string" && n.trim().length > 0);

    const agg = await Match.aggregate([
      {
        $match: {
          $or: [
            { winnerName: { $in: followedNames } },
            { loserName: { $in: followedNames } },
          ],
        },
      },
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
          total: { $add: [{ $ifNull: ["$wins", 0] }, { $ifNull: ["$losses", 0] }] },
          winRate: {
            $cond: [
              { $eq: [{ $add: ["$wins", "$losses"] }, 0] },
              0,
              { $divide: ["$wins", { $add: ["$wins", "$losses"] }] },
            ],
          },
        },
      },
      { $sort: { winRate: -1, wins: -1 } },
      {
        $project: {
          _id: 0,
          name: "$_id",
          wins: 1,
          losses: 1,
          total: 1,
          winRate: { $round: ["$winRate", 3] },
        },
      },
    ]);

    const rankMap = new Map();
    agg.forEach((row, i) => rankMap.set((row.name || "").toLowerCase(), i + 1));

    const formatted = follows.map((f) => {
      const safeName = typeof f.playerName === "string" ? f.playerName : "Unknown Player";
      const rank = rankMap.get(safeName.toLowerCase()) || "N/A";
      return {
        playerId: f.playerId,
        name: safeName,
        country: f.country || "Unknown",
        rank,
        imageUrl:
          f.imageUrl ||
          `https://flagcdn.com/64x48/${(f.country || "unk").toLowerCase()}.png`,
      };
    });

    return res.json({ count: formatted.length, follows: formatted });
  } catch (err) {
    console.error("❌ getFollows error:", err);
    return res.status(500).json({ message: "Failed to fetch follow list", error: err.message });
  }
};
