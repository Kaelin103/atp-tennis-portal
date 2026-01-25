console.log("Starting script...");
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Match } from './src/models/Match.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/atp_tennis";

async function run() {
  console.log("Connecting...");
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Get Dataset Now
    const [row] = await Match.aggregate([
      { $group: { _id: null, maxDate: { $max: "$tourneyDate" } } },
    ]);
    const datasetNow = row?.maxDate || new Date();
    console.log('Dataset Now:', datasetNow);

    // 2. Window 52w
    const days = 364;
    const cutoff = new Date(datasetNow.getTime() - days * 24 * 60 * 60 * 1000);
    console.log('Cutoff:', cutoff);

    // 3. Pipeline Simulation
    const baseMatch = {
      $or: [
        { tourneyDate: { $gte: cutoff, $lte: datasetNow } },
        { year: { $gte: cutoff.getFullYear() } },
      ],
    };

    const pipeline = [{ $match: baseMatch }];
    
    // Add grouping logic from controller
    pipeline.push(
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
          wins: { $ifNull: ["$wins", 0] },
          losses: { $ifNull: ["$losses", 0] },
          total: { $add: [{ $ifNull: ["$wins", 0] }, { $ifNull: ["$losses", 0] }] },
        },
      },
      { $match: { total: { $gte: 2 } } }, // minMatches = 2
      { $sort: { wins: -1 } },
      { $limit: 5 }
    );

    const ranking = await Match.aggregate(pipeline);
    console.log('Top 5 Players in last 52w (relative to dataset):');
    console.log(ranking);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log("Done.");
  }
}

run();
