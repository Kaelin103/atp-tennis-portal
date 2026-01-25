// backend/src/controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { sendMail } from "../config/mailer.js"; 

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password, country = "", avatar = "", role } = req.body || {};
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required." });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      role: role === "admin" ? "admin" : "user", // Only allow explicit 'admin'; otherwise default to 'user'
      country,
      avatar,
    });

    const token = signToken(user);
    return res.status(201).json({
      message: "Registration successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country || "",
        avatar: user.avatar || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user)
      return res.status(401).json({ message: "Invalid email or password." });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok)
      return res.status(401).json({ message: "Invalid email or password." });

    const token = signToken(user);
    return res.json({
      message: "Login successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country || "",
        avatar: user.avatar || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user?.id).lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
        country: user.country || "",
        avatar: user.avatar || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || "",
        role: user.role || "user",
        country: user.country || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { name, email, avatar, country } = req.body || {};

    if (email) {
      const existing = await User.findOne({ email });
      if (existing && existing._id.toString() !== decoded.id) {
        return res
          .status(409)
          .json({ message: "Email already in use by another account." });
      }
    }

    const updateDoc = {};
    if (typeof name === "string") updateDoc.name = name;
    if (typeof email === "string") updateDoc.email = email;
    if (typeof avatar === "string") updateDoc.avatar = avatar;
    if (typeof country === "string") updateDoc.country = country.trim().toUpperCase();

    const updated = await User.findByIdAndUpdate(decoded.id, updateDoc, {
      new: true,
      runValidators: true,
      select: "-passwordHash",
    });

    if (!updated) return res.status(404).json({ message: "User not found." });

    res.json({
      message: "Profile updated successfully.",
      user: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar || "",
        role: updated.role || "user",
        country: updated.country || "",
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email)
      return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "No account found with that email." });

    const token = crypto.randomBytes(20).toString("hex");
    const resetLink = `http://localhost:5173/reset-password/${token}`;

    await sendMail(
      email,
      "Password Reset Request",
      `<p>Hello ${user.name || "user"},</p>
       <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
       <p>This link will expire in 1 hour.</p>`
    );

    return res.json({ message: "Reset link sent to your email." });
  } catch (err) {
    next(err);
  }
}
