import { prisma } from "../config/database.js";
import type { CreateEpisodeDTO } from "../validators/episode.validator.js";

export class EpisodeRepository {
    async create(showId: string, data: CreateEpisodeDTO) {
        return prisma.episode.create({
            data: {
                showId,
                title: data.title,
                description: data.description,
                audioUrl: data.audioUrl,
                durationInSeconds: data.durationInSeconds,
                episodeNumber: data.episodeNumber,
            },
            select: {
                id: true,
                showId: true,
                title: true,
                description: true,
                audioUrl: true,
                durationInSeconds: true,
                episodeNumber: true,
                createdAt: true,
            },
        });
    }

    async findAllByShowId(
    showId: string,
    page: number,
    limit: number,
) {
    const skip = (page - 1) * limit;

    const [episodes, total] = await prisma.$transaction([
        prisma.episode.findMany({
            where: { showId },
            skip,
            take: limit,
            orderBy: {
                episodeNumber: "asc",
            },
            select: {
                id: true,
                showId: true,
                title: true,
                description: true,
                durationInSeconds: true,
                episodeNumber: true,
                createdAt: true,
            },
        }),
        prisma.episode.count({
            where: { showId },
        }),
    ]);

    return {
        episodes,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async findById(showId: string, episodeId: string) {
    return prisma.episode.findFirst({
        where: {
            id: episodeId,
            showId,
        },
        select: {
            id: true,
            showId: true,
            title: true,
            description: true,
            audioUrl: true,
            durationInSeconds: true,
            episodeNumber: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}
}