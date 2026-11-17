
import { z } from "zod";

const categoryIdsSchema = z
    .array(z.string().uuid())
    .max(20, "A show cannot have more than 20 categories")
    .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate category IDs are not allowed",
    );

export const createShowSchema = z.object({
    title: z.string().trim().min(2).max(200),

    description: z.string().trim().min(10).max(5000),

    coverUploadId: z.string().uuid().optional(),

    categoryIds: categoryIdsSchema.optional(),
});

export const listShowsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),

    categoryId: z.string().uuid().optional(),

    limit: z.coerce.number().int().min(1).max(50).default(10),

    search: z.string().trim().min(1).max(100).optional(),

    sortBy: z.enum(["newest", "oldest", "popular"]).default("newest"),
});

export const showIdSchema = z.object({
    showId: z.string().uuid(),
});

export const updateShowSchema = z
    .object({
        title: z.string().trim().min(2).max(200).optional(),

        description: z.string().trim().min(10).max(5000).optional(),

        coverUploadId: z.string().uuid().optional(),

        categoryIds: categoryIdsSchema.optional(),
    })
    .refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        {
            message: "At least one field must be provided",
        },
    );

export const listTrendingShowsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listRecommendationsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListRecommendationsDTO = z.infer<
    typeof listRecommendationsSchema
>;

export type ListTrendingShowsDTO = z.infer<
    typeof listTrendingShowsSchema
>;

export type UpdateShowDTO = z.infer<typeof updateShowSchema>;
export type ShowIdDTO = z.infer<typeof showIdSchema>;
export type ListShowsDTO = z.infer<typeof listShowsSchema>;
export type CreateShowDTO = z.infer<typeof createShowSchema>;
