import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from './src/models/User.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/atp_tennis";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const email = "testadmin@atp.com";
    const newPassword = "Admin123!";
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const result = await User.findOneAndUpdate(
      { email: email },
      { $set: { passwordHash: passwordHash } },
      { new: true }
    );

    if (result) {
      console.log(`Password for ${email} has been reset to: ${newPassword}`);
    } else {
      console.log(`User ${email} not found. Creating it...`);
      await User.create({
          name: "Test Admin",
          email: email,
          passwordHash: passwordHash,
          role: "admin"
      });
      console.log(`User ${email} created with password: ${newPassword}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
