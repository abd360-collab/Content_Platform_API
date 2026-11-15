import { z } from "zod";

export const createShowSchema = z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(10).max(5000),
    coverImageUrl: z.string().url().optional(),
});

export const listShowsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(50).default(10),

    search: z.string().trim().max(100).optional(),

    sortBy: z.enum(["newest", "oldest"]).default("newest"),
});

export const showIdSchema = z.object({
    showId: z.string().uuid(),
});

export const updateShowSchema = z
    .object({
        title: z.string().trim().min(2).max(200).optional(),

        description: z.string().trim().min(10).max(5000).optional(),

        coverImageUrl: z.string().url().nullable().optional(),
    })
    .refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        {
            message: "At least one field must be provided",
        },
    );

export type UpdateShowDTO = z.infer<typeof updateShowSchema>;
export type ShowIdDTO = z.infer<typeof showIdSchema>;
export type ListShowsDTO = z.infer<typeof listShowsSchema>;
export type CreateShowDTO = z.infer<typeof createShowSchema>;