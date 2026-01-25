// backend/src/config/db.js
import mongoose from "mongoose";
import { env } from "./env.js";
import { MongoMemoryServer } from "mongodb-memory-server";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.warn(
      `⚠️ Failed to connect to MongoDB at ${env.mongoUri}. Starting in-memory MongoDB for development...`
    );
    const mem = await MongoMemoryServer.create();
    const uri = mem.getUri();
    await mongoose.connect(uri);
    console.log("✅ Connected to in-memory MongoDB");
  }
}
