import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
    changeMyPassword,
    deleteMyAccount,
    getAccountStats,
    getMyProfile,
    updateMyProfile,
} from "./user.controller.js";
import { updateProfileSchema } from "../auth/auth.validator.js";
import { changePasswordSchema } from "./user.validator.js";
import { listProgressSchema } from "../progress/progress.validator.js";
import { deleteAllProgress, getUserHistory } from "../progress/progress.controller.js";
import { listRecommendationsSchema } from "../shows/show.validator.js";
import { getRecommendations } from "../follows/follow.controller.js";

const router = Router();

router.get("/me", requireAuth, getMyProfile);

router.patch(
    "/me",
    requireAuth,
    validate(updateProfileSchema),
    updateMyProfile,
);

router.patch(
    "/me/password",
    requireAuth,
    validate(changePasswordSchema),
    changeMyPassword,
);

router.delete("/me", requireAuth, deleteMyAccount);


router.get(
    "/me/history",
    requireAuth,
    validate(listProgressSchema, "query"),
    getUserHistory,
);


router.delete(
    "/me/history",
    requireAuth,
    deleteAllProgress,
);


router.get(
    "/me/stats",
    requireAuth,
    getAccountStats,
);


router.get(
    "/me/recommendations",
    requireAuth,
    validate(listRecommendationsSchema, "query"),
    getRecommendations,
);

export default router;