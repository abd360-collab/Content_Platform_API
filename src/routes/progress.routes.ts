import { Router } from "express";
import { getProgress, saveProgress } from "../controllers/progress.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    episodeProgressParamsSchema,
    saveProgressSchema,
} from "../validators/progress.validator.js";

const router = Router();

router.put(
    "/:episodeId/progress",
    requireAuth,
    validate(episodeProgressParamsSchema, "params"),
    validate(saveProgressSchema, "body"),
    saveProgress,
);

router.get(
    "/:episodeId/progress",
    requireAuth,
    validate(episodeProgressParamsSchema, "params"),
    getProgress,
);

export default router;