// backend/src/config/mailer.js
import nodemailer from "nodemailer";
import { env } from "./env.js";

export const mailer = nodemailer.createTransport({
  host: env.mail.host,
  port: env.mail.port,
  secure: false, 
  auth: {
    user: env.mail.user,
    pass: env.mail.pass,
  },
});

export async function sendMail(to, subject, html) {
  try {
    await mailer.sendMail({
      from: env.mail.from,
      to,
      subject,
      html,
    });
    console.log(`📧 Mail sent to ${to}: ${subject}`);
  } catch (err) {
    console.error("❌ Mail send error:", err);
  }
}
