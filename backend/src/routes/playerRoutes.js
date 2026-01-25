import express from "express";
import {
  getRankings,
  getDynamicRankings,
  getPlayerStats,
  getPlayerById,
  getHeadToHeadByName,
  getHeadToHeadSummary,
  getTopHeadToHead,
  getCompareRadar,
  getSurfaceStats,
  getSurfaceYearlyStats,
  getSurfaceLevelStats,
  getPlayerTimeline,
  searchPlayers,
  clearCache,
  lookupCountry,
  clearCountryIndex,
} from "../controllers/playerController.js";

const router = express.Router();

router.get("/", getRankings);

router.get("/rankings", getRankings);
router.get("/rankings/dynamic", getDynamicRankings);
router.get("/stats/:name", getPlayerStats);
router.get("/id/:id", getPlayerById);

router.get("/headtohead", getHeadToHeadByName);
router.get("/headtohead/summary", getHeadToHeadSummary);
router.get("/headtohead/top", getTopHeadToHead);

router.get("/compare/radar", getCompareRadar);

router.get("/surfaces", getSurfaceStats);
router.get("/surfaces/yearly", getSurfaceYearlyStats);
router.get("/surfaces/levels", getSurfaceLevelStats);

router.get("/:id/metrics/timeline", getPlayerTimeline);

router.get("/search", searchPlayers);
router.post("/clear-cache", clearCache);
router.post("/clear-country-index", clearCountryIndex);

// debug route: country lookup by name
router.get("/country/lookup", lookupCountry);

export default router;
