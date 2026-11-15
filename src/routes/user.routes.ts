import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    changeMyPassword,
    deleteMyAccount,
    getMyProfile,
    updateMyProfile,
} from "../controllers/user.controller.js";
import { updateProfileSchema } from "../validators/auth.validator.js";
import { changePasswordSchema } from "../validators/user.validator.js";

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

export default router;