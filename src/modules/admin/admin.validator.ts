import { z } from "zod";

export const listUsersSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(50).default(10),

    search: z.string().trim().max(100).optional(),

    role: z.enum(["CUSTOMER", "ADMIN"]).optional(),

    sortBy: z.enum(["newest", "oldest"]).default("newest"),
});

export type ListUsersDTO = z.infer<typeof listUsersSchema>;