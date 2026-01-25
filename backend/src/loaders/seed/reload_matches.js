import { loadMatches } from "./loadMatches.js";
import { connectDB } from "../../config/db.js";
import { Match } from "../../models/Match.js";
import mongoose from "mongoose";

async function reload() {
  console.log("🔄 Force Reloading Matches...");
  await connectDB();
  
  console.log("🗑️ Deleting existing matches...");
  await Match.deleteMany({});
  console.log("✅ Matches deleted.");

  await loadMatches();

  console.log("✅ Match reload complete.");
  await mongoose.connection.close();
}

reload();
