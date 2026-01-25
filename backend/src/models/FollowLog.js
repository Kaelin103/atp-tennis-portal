// backend/src/models/FollowLog.js
import mongoose from "mongoose";

const followLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    playerId: { type: mongoose.Schema.Types.Mixed },
    playerName: { type: String },
    country: { type: String },
    action: { type: String, enum: ["follow", "unfollow"], required: true },
  },
  { timestamps: true }
);

followLogSchema.index({ userId: 1, createdAt: -1 });

export const FollowLog = mongoose.model("FollowLog", followLogSchema);