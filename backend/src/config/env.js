// backend/src/config/env.js
import { config } from "dotenv";
config(); 

console.log("✅ env.js loaded");

export const env = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/atp_tennis",
  jwtSecret: process.env.JWT_SECRET || "change_this_in_production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  mail: {
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT || 587),
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASS || "",
    from: process.env.MAIL_FROM || "ATP Tennis Portal <no-reply@example.com>",
  },
};

console.log("MONGODB_URI (from env.js) =", env.mongoUri);
