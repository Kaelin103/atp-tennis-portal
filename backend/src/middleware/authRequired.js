// backend/src/authRequired.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: Missing token." });
    }

    const token = auth.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role || "user",
    };
    next();
  } catch (err) {
    console.error("❌ [authRequired] JWT verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
