
import { Router } from "express";

import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
} from "../controllers/category.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

import {
    createCategorySchema,
    listCategoriesSchema,
    categoryIdSchema,
    updateCategorySchema,
} from "../validators/category.validator.js";

const router = Router();

// Public: List categories
router.get(
    "/",
    validate(listCategoriesSchema, "query"),
    getAllCategories,
);

// Public: Get category details
router.get(
    "/:categoryId",
    validate(categoryIdSchema, "params"),
    getCategoryById,
);

// Admin: Create category
router.post(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate(createCategorySchema),
    createCategory,
);

// Admin: Update category
router.patch(
    "/:categoryId",
    requireAuth,
    requireRole("ADMIN"),
    validate(categoryIdSchema, "params"),
    validate(updateCategorySchema),
    updateCategory,
);

// Admin: Delete category
router.delete(
    "/:categoryId",
    requireAuth,
    requireRole("ADMIN"),
    validate(categoryIdSchema, "params"),
    deleteCategory,
);

export default router;
