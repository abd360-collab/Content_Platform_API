import { Router } from "express";
import { getDashboardStats, getUsers } from "./admin.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { listUsersSchema } from "./admin.validator.js";
import { validate } from "../../middleware/validate.middleware.js";

const router = Router();

router.get(
    "/dashboard",
    requireAuth,
    requireRole("ADMIN"),
    getDashboardStats,
);

router.get(
    "/users",
    requireAuth,
    requireRole("ADMIN"),
    validate(listUsersSchema, "query"),
    getUsers,
);

export default router;