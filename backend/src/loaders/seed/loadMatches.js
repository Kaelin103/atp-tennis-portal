// src/loaders/seed/loadMatches.js
import fs from "fs";
import path from "path";
import url from "url";
import csv from "csv-parser";
import mongoose from "mongoose";
import { Match } from "../../models/Match.js";
import { connectDB } from "../../config/db.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadMatches() {
  console.log("🎾 [DEBUG] loadMatches() started");

  await connectDB();
  console.log("✅ MongoDB connected (loadMatches)");

  const dataDir = path.resolve(__dirname, "../../../../datasets/tennis_atp");

  const allFiles = fs.readdirSync(dataDir);
  const matchFiles = allFiles
    .filter(f => /^atp_matches_\d{4}\.csv$/.test(f))
    .sort((a, b) => {
      const ay = parseInt(a.match(/\d{4}/)[0]);
      const by = parseInt(b.match(/\d{4}/)[0]);
      return ay - by;
    });

  console.log(`📦 Found ${matchFiles.length} yearly match files.`);
  if (matchFiles.length === 0) {
    console.error("❌ No yearly ATP match files found!");
    process.exit(1);
  }

  for (const file of matchFiles) {
    const year = file.match(/\d{4}/)[0];
    const filePath = path.join(dataDir, file);
    console.log(`📂 Importing matches for ${year} from: ${filePath}`);

    const matches = [];
    let headerChecked = false;

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          if (!headerChecked) {
            console.log(`🧾 [${year}] CSV headers:`, Object.keys(row));
            headerChecked = true;
          }

          matches.push({
            tourneyId: row.tourney_id || "",
            tourneyName: row.tourney_name || "",
            surface: row.surface || "",
            drawSize: Number(row.draw_size) || null,
            tourneyLevel: row.tourney_level || "",
            tourneyDate:
  row.tourney_date && /^\d{8}$/.test(row.tourney_date)
    ? new Date(
        `${row.tourney_date.slice(0, 4)}-${row.tourney_date.slice(4, 6)}-${row.tourney_date.slice(6, 8)}`
      )
    : row.tourney_date && !isNaN(Date.parse(row.tourney_date))
    ? new Date(row.tourney_date)
    : null,

            matchNum: Number(row.match_num) || null,
            winnerId: Number(row.winner_id) || null,
            winnerName: row.winner_name || "",
            loserId: Number(row.loser_id) || null,
            loserName: row.loser_name || "",
            score: row.score || "",
            bestOf: Number(row.best_of) || null,
            round: row.round || "",
            minutes: Number(row.minutes) || null,
            wAce: Number(row.w_ace) || null,
            wDf: Number(row.w_df) || null,
            wSvGms: Number(row.w_sv_gms) || null,
            lAce: Number(row.l_ace) || null,
            lDf: Number(row.l_df) || null,
            lSvGms: Number(row.l_sv_gms) || null,
          });
        })
        .on("end", async () => {
          console.log(`✅ [${year}] Parsed ${matches.length} matches`);
          try {
            await Match.insertMany(matches);
            console.log(`✅ [${year}] Inserted ${matches.length} matches`);
            resolve();
          } catch (err) {
            console.error(`❌ [${year}] Insert failed:`, err.message);
            reject(err);
          }
        })
        .on("error", (err) => {
          console.error(`❌ [${year}] CSV read error:`, err);
          reject(err);
        });
    });
  }

  console.log("🏁 All yearly ATP match data imported successfully!");
  mongoose.connection.close();
}

const currentFile = url.fileURLToPath(import.meta.url);
const calledFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentFile === calledFile || calledFile.endsWith("loadMatches.js")) {
  loadMatches();
}
