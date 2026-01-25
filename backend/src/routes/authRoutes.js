import express from "express";
import {
  register,
  login,
  me,
  getProfile,
  updateProfile,
} from "../controllers/authController.js";
import { authRequired } from "../middleware/authRequired.js";

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.get("/me", authRequired, me);

router.get("/profile", getProfile);

router.put("/profile/update", authRequired, updateProfile);

export default router;
