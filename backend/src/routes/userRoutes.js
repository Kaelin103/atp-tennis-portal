import express from "express";
import { authRequired } from "../middleware/authRequired.js";
import { getProfile, updateProfile } from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", authRequired, getProfile);

router.put("/profile", authRequired, updateProfile);

export default router;
