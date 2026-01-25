// backend/src/routes/matchRoutes.js
import express from "express";
import {
  getAllMatches,
  getMatchesByFilter,
  getHeadToHead,
} from "../controllers/matchController.js";

const router = express.Router();

router.get("/", getAllMatches);
router.get("/filter", getMatchesByFilter);
router.get("/filter/:name", getMatchesByFilter);
router.get("/filter/:name/:year", getMatchesByFilter);
router.get("/headtohead", getHeadToHead);

export default router;
