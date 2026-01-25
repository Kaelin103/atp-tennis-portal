import express from "express";
import { getOverview, getAllUsersWithFollows, getFollowLogs } from "../controllers/adminController.js";
import { authRequired } from "../middleware/authRequired.js";
import { isAdmin } from "../middleware/isAdmin.js";

const router = express.Router();

router.get("/overview", authRequired, isAdmin, getOverview);

router.get("/users", authRequired, isAdmin, getAllUsersWithFollows);

router.get("/follows/logs", authRequired, isAdmin, getFollowLogs);

export default router;