// backend/src/server.js
import { config } from "dotenv";
config();

import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function startServer() {
  try {
    
    await connectDB();
    console.log("✅ MongoDB connected successfully");

    const app = createApp();
    if (!app) {
      throw new Error("❌ createApp() returned undefined — check app.js export");
    }

    const PORT = env.port || process.env.PORT || 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  process.exit(1);
});

startServer();
