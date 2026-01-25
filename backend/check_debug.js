import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Match } from './src/models/Match.js';
import { User } from './src/models/User.js'; // Assuming User model exists
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/atp_tennis";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Check User
    const email = "testadmin@atp.com";
    const user = await mongoose.connection.db.collection('users').findOne({ email: email });
    if (user) {
      console.log(`User found: ${user.email}`);
      console.log(`Password Hash: ${user.password}`);
      console.log(`Role: ${user.role}`);
    } else {
      console.log(`User ${email} NOT found.`);
      // Check admin@example.com
       const admin = await mongoose.connection.db.collection('users').findOne({ email: 'admin@example.com' });
       if (admin) {
           console.log('Found default admin: admin@example.com');
       }
    }

    // 2. Check Max Date
    const result = await Match.aggregate([
      {
        $group: {
          _id: null,
          maxDate: { $max: "$tourneyDate" },
          minDate: { $min: "$tourneyDate" },
          cnt: { $sum: 1 }
        }
      }
    ]);
    
    if (result.length > 0) {
      console.log('Match Data Stats:', result[0]);
      console.log('Max Date Type:', typeof result[0].maxDate);
    } else {
      console.log('No matches found.');
    }
    
    // Check a sample match to see tourneyDate format
    const sample = await Match.findOne().lean();
    if (sample) {
        console.log('Sample Match tourneyDate:', sample.tourneyDate, 'Type:', typeof sample.tourneyDate);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
