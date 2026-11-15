import { z } from "zod";

export const createEpisodeSchema = z.object({
    title: z.string().trim().min(2).max(200),

    description: z.string().trim().min(10).max(5000),

    audioUrl: z.string().url(),

    durationInSeconds: z.number().int().positive(),

    episodeNumber: z.number().int().positive(),
});

export const listEpisodesSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const episodeParamsSchema = z.object({
    showId: z.string().uuid(),
    episodeId: z.string().uuid(),
});

export type EpisodeParamsDTO = z.infer<typeof episodeParamsSchema>;
export type ListEpisodesDTO = z.infer<typeof listEpisodesSchema>;
export type CreateEpisodeDTO = z.infer<typeof createEpisodeSchema>;