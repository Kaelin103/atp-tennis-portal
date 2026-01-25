// backend/models/Follow.js
import mongoose from "mongoose";

const followSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    playerId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    playerName: { type: String },
    country: { type: String },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

followSchema.index({ userId: 1, playerId: 1 }, { unique: true });

followSchema.virtual("playerBrief", {
  ref: "Player",
  localField: "playerId",
  foreignField: "_id",
  justOne: true,
  options: { select: "firstName lastName countryCode imageUrl" },
});

export const Follow = mongoose.model("Follow", followSchema);
