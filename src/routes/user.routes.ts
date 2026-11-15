import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    changeMyPassword,
    deleteMyAccount,
    getAccountStats,
    getMyProfile,
    updateMyProfile,
} from "../controllers/user.controller.js";
import { updateProfileSchema } from "../validators/auth.validator.js";
import { changePasswordSchema } from "../validators/user.validator.js";
import { listProgressSchema } from "../validators/progress.validator.js";
import { deleteAllProgress, getUserHistory } from "../controllers/progress.controller.js";

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

export default router;