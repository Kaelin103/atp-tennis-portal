// backend/src/jobs/showAdminData.js
import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

async function ensureAdminAndToken() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "Admin123!";
  const name = process.env.ADMIN_NAME || "Admin User";

  await connectDB();
  const hash = await bcrypt.hash(password, 10);
  let user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    user = await User.create({ name, email, passwordHash: hash, role: "admin" });
  } else {
    user.role = "admin";
    user.passwordHash = hash;
    await user.save();
  }
  const token = jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: "admin" },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || "7d" }
  );
  return token;
}

async function run() {
  try {
    const token = await ensureAdminAndToken();

    const headers = { Authorization: `Bearer ${token}` };
    const base = process.env.API_BASE || "http://localhost:5000";

    const overviewRes = await fetch(`${base}/api/admin/overview`, { headers });
    const overview = await overviewRes.json();

    const usersRes = await fetch(`${base}/api/admin/users`, { headers });
    const users = await usersRes.json();

    console.log("ADMIN_OVERVIEW:");
    console.log(JSON.stringify(overview, null, 2));
    console.log("ADMIN_USERS:");
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("❌ showAdminData failed:", err);
    process.exit(1);
  } finally {
    try { await mongoose.connection.close(); } catch {}
    process.exit(0);
  }
}

run();