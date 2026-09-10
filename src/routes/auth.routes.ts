import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { loginSchema, refreshTokenSchema, registerSchema } from "../validators/auth.validator";
import { login, refresh, register } from "../controllers/auth.controller";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refresh);

export default router;