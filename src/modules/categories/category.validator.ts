
import { z } from "zod";

export const createCategorySchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Category name must contain at least 2 characters")
        .max(50, "Category name cannot exceed 50 characters"),

    slug: z
        .string()
        .trim()
        .min(2, "Category slug must contain at least 2 characters")
        .max(60, "Category slug cannot exceed 60 characters")
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Slug must contain lowercase letters, numbers and hyphens only",
        ),

    description: z
        .string()
        .trim()
        .max(500, "Description cannot exceed 500 characters")
        .optional(),
});

export const listCategoriesSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().max(100).optional(),
});

export const categoryIdSchema = z.object({
    categoryId: z.string().uuid(),
});

export const updateCategorySchema = z.object({
    name: z
        .string()
        .trim()
        .min(2)
        .max(50)
        .optional(),

    slug: z
        .string()
        .trim()
        .min(2)
        .max(60)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),

    description: z
        .string()
        .trim()
        .max(500)
        .nullable()
        .optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided" },
);

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>;
export type ListCategoriesDTO = z.infer<typeof listCategoriesSchema>;
export type CategoryIdDTO = z.infer<typeof categoryIdSchema>;
export type UpdateCategoryDTO = z.infer<typeof updateCategorySchema>;
