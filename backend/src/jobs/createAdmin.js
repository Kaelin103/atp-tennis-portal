// backend/src/jobs/createAdmin.js
import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "Admin123!";
  const name = process.env.ADMIN_NAME || "Admin User";

  await connectDB();

  const hash = await bcrypt.hash(password, 10);
  let user = await User.findOne({ email }).select("+passwordHash");

  if (!user) {
    user = await User.create({
      name,
      email,
      passwordHash: hash,
      role: "admin",
    });
    console.log("✅ Admin user created:", email);
  } else {
    // Ensure role and known password
    user.role = "admin";
    user.passwordHash = hash;
    await user.save();
    console.log("🔄 Admin user ensured:", email);
  }

  const token = jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: "admin",
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || "7d" }
  );

  console.log("ADMIN_TOKEN:", token);
}

ensureAdmin()
  .catch((err) => {
    console.error("❌ Failed to ensure admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(0);
  });