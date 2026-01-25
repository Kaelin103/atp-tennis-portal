// backend/routes/followRoutes.js
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  followPlayer,
  unfollowPlayer,
  getFollows,
} from "../controllers/followController.js";

import { authRequired } from "../middleware/authRequired.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.use(authRequired);

router.post("/:playerId", followPlayer);

router.delete("/:playerId", unfollowPlayer);

router.get("/", getFollows);

export default router;
