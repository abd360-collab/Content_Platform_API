
import { Router } from "express";

import { validate } from "../middleware/validate.middleware";
import {
    loginSchema,
    refreshTokenSchema,
    registerSchema,
} from "../validators/auth.validator";

import {
    login,
    logout,
    logoutAll,
    refresh,
    register,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", validate(registerSchema), register);

router.post("/login", validate(loginSchema), login);

router.post("/refresh", validate(refreshTokenSchema), refresh);

router.post("/logout", validate(refreshTokenSchema), logout);

router.post(
    "/logout-all",
    requireAuth,
    logoutAll,
);

export default router;
