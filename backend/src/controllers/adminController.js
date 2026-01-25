// backend/src/controllers/adminController.js
import { User } from "../models/User.js";
import { Follow } from "../models/Follow.js";
import { Player } from "../models/Player.js";
import { Match } from "../models/Match.js";
import { FollowLog } from "../models/FollowLog.js";

export async function getOverview(req, res) {
  try {
    const [users, admins, players, matches, follows] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      Player.countDocuments(),
      Match.countDocuments(),
      Follow.countDocuments(),
    ]);

    const topFollowed = await Follow.aggregate([
      { $group: { _id: "$playerName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    return res.json({
      users,
      admins,
      players,
      matches,
      follows,
      topFollowed,
    });
  } catch (err) {
    console.error("❌ [admin.getOverview] error:", err);
    return res.status(500).json({ message: "Failed to fetch admin overview" });
  }
}

export async function getAllUsersWithFollows(req, res) {
  try {
    // 1) Aggregate each user's follow count and names
    const followAgg = await Follow.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
          names: { $addToSet: "$playerName" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Build mapping: userId -> follow count / names
    const countMap = new Map();
    const namesMap = new Map();
    for (const f of followAgg) {
      const key = String(f._id);
      countMap.set(key, f.count || 0);
      namesMap.set(
        key,
        (Array.isArray(f.names) ? f.names : []).filter((n) => typeof n === "string")
      );
    }

    // 2) Fetch all users (including those without any follows)
    const users = await User.find()
      .select("name email role country avatar createdAt")
      .lean();

    // 3) Merge results and return
    const result = users.map((u) => ({
      id: String(u._id),
      name: u?.name || "Unknown",
      email: u?.email || "",
      role: u?.role || "user",
      country: u?.country || "",
      avatar: u?.avatar || "",
      followCount: countMap.get(String(u._id)) ?? 0,
      followedPlayers: namesMap.get(String(u._id)) ?? [],
      createdAt: u?.createdAt || null,
    }));

    return res.json({ count: result.length, users: result });
  } catch (err) {
    console.error("❌ [admin.getAllUsersWithFollows] error:", err);
    return res.status(500).json({ message: "Failed to fetch users with follows" });
  }
}

// GET /admin/follows/logs
export async function getFollowLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const action = req.query.action; // optional: 'follow' | 'unfollow'
    const keyword = (req.query.q || "").trim();

    const filter = {};
    if (action && ["follow", "unfollow"].includes(action)) {
      filter.action = action;
    }
    if (keyword) {
      filter.$or = [
        { playerName: new RegExp(keyword, "i") },
        // join on User after fetch for name filtering
      ];
    }

    const total = await FollowLog.countDocuments(filter);
    const logs = await FollowLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // enrich with user name
    const userIds = [...new Set(logs.map((l) => String(l.userId)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email role")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const rows = logs.map((l) => ({
      id: String(l._id),
      userId: String(l.userId),
      userName: userMap.get(String(l.userId))?.name || "Unknown",
      playerId: l.playerId ?? null,
      playerName: l.playerName || "",
      country: l.country || "",
      action: l.action,
      time: l.createdAt,
    }));

    return res.json({ total, page, pageSize: limit, logs: rows });
  } catch (err) {
    console.error("❌ [admin.getFollowLogs] error:", err);
    return res.status(500).json({ message: "Failed to fetch follow logs" });
  }
}