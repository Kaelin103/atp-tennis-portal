// src/loaders/seed/loadPlayers.js
import fs from "fs";
import path from "path";
import url from "url";
import csv from "csv-parser";
import mongoose from "mongoose";
import { Player } from "../../models/Player.js";
import { connectDB } from "../../config/db.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseDate(dob) {
  if (!dob) return null;
  // Handle formats like YYYYMMDD or YYYY-MM-DD
  if (/^\d{8}$/.test(dob)) {
    const y = dob.slice(0, 4);
    const m = dob.slice(4, 6);
    const d = dob.slice(6, 8);
    return new Date(`${y}-${m}-${d}`);
  }
  const parsed = Date.parse(dob);
  return isNaN(parsed) ? null : new Date(parsed);
}

export async function loadPlayers() {
  console.log("🎾 [DEBUG] loadPlayers() started");

  await connectDB();
  console.log("✅ MongoDB connected (loadPlayers)");

  const dataDir = path.resolve(__dirname, "../../../../datasets/tennis_atp");
  const filePath = path.join(dataDir, "atp_players.csv");
  if (!fs.existsSync(filePath)) {
    console.error("❌ atp_players.csv not found at:", filePath);
    process.exit(1);
  }

  console.log("📂 Importing players from:", filePath);
  const ops = [];
  let count = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const playerId = Number(row.player_id) || null;
        const firstName = row.name_first || "";
        const lastName = row.name_last || "";
        const hand = row.hand || ""; // R or L
        const birthDate = parseDate(row.dob);
        const countryCode = row.country_code || "";

        if (!playerId) return; // skip invalid rows

        ops.push({
          updateOne: {
            filter: { playerId },
            update: {
              $set: { playerId, firstName, lastName, hand, birthDate, countryCode },
            },
            upsert: true,
          },
        });
        count++;
      })
      .on("end", async () => {
        console.log(`✅ Parsed ${count} players, performing upserts...`);
        try {
          if (ops.length > 0) {
            const res = await Player.bulkWrite(ops, { ordered: false });
            console.log(
              `✅ Players upserted: matched ${res.nMatched || 0}, upserted ${
                res.nUpserted || 0
              }, modified ${res.nModified || 0}`
            );
          } else {
            console.log("ℹ️ No player rows to upsert.");
          }
          resolve();
        } catch (err) {
          console.error("❌ Player upsert failed:", err.message);
          reject(err);
        }
      })
      .on("error", (err) => {
        console.error("❌ CSV read error:", err);
        reject(err);
      });
  });

  console.log("🏁 Player data import complete!");
  mongoose.connection.close();
}

const currentFile = url.fileURLToPath(import.meta.url);
const calledFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === calledFile || calledFile.endsWith("loadPlayers.js")) {
  loadPlayers();
}
