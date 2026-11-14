import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getMyProfile } from "../controllers/user.controller.js";

const router = Router();

router.get("/me", requireAuth, getMyProfile);

export default router;