import { z } from "zod";

export const saveProgressSchema = z.object({
    positionInSeconds: z.number().int().min(0),
});

export const episodeProgressParamsSchema = z.object({
    episodeId: z.string().uuid(),
});

export const listProgressSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListProgressDTO = z.infer<typeof listProgressSchema>;
export type SaveProgressDTO = z.infer<typeof saveProgressSchema>;

export type EpisodeProgressParamsDTO = z.infer<
    typeof episodeProgressParamsSchema
>;