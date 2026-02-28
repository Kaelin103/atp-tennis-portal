import express from "express";
import { predictMatch } from "../controllers/predictController.js";

const router = express.Router();

// POST /api/predict
router.post("/", predictMatch);

export default router;
