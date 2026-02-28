import mongoose from "mongoose";
import { Player } from "./src/models/Player.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/atp_tennis";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected");

  const count = await Player.countDocuments({});
  console.log("Total players:", count);

  const decayNot05 = await Player.countDocuments({ decay_score: { $ne: 0.5 } });
  console.log("Players with decay != 0.5:", decayNot05);

  const decayHigh = await Player.countDocuments({ decay_score: { $gte: 0.6 } });
  console.log("Players with decay >= 0.6:", decayHigh);

  const decayLow = await Player.countDocuments({ decay_score: { $lte: 0.4 } });
  console.log("Players with decay <= 0.4:", decayLow);
  
  if (decayNot05 > 0) {
      const sample = await Player.findOne({ decay_score: { $ne: 0.5 } }).lean();
      console.log("Sample non-0.5:", sample);
  }

  await mongoose.disconnect();
}

run();
