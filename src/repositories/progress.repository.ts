import { prisma } from "../config/database.js";
import type { SaveProgressDTO } from "../validators/progress.validator.js";

export class ProgressRepository {
    async saveProgress(
        userId: string,
        episodeId: string,
        data: SaveProgressDTO,
    ) {
        return prisma.listeningProgress.upsert({
            where: {
                userId_episodeId: {
                    userId,
                    episodeId,
                },
            },
            create: {
                userId,
                episodeId,
                positionInSeconds: data.positionInSeconds,
            },
            update: {
                positionInSeconds: data.positionInSeconds,
            },
            select: {
                userId: true,
                episodeId: true,
                positionInSeconds: true,
                updatedAt: true,
            },
        });
    }

    async findProgress(userId: string, episodeId: string) {
    return prisma.listeningProgress.findUnique({
        where: {
            userId_episodeId: {
                userId,
                episodeId,
            },
        },
        select: {
            episodeId: true,
            positionInSeconds: true,
            updatedAt: true,
            episode: {
                select: {
                    id: true,
                    title: true,
                    durationInSeconds: true,
                    episodeNumber: true,
                    show: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            },
        },
    });
}


   async findUserHistory(
    userId: string,
    page: number,
    limit: number,
) {
    const skip = (page - 1) * limit;

    const [history, total] = await prisma.$transaction([
        prisma.listeningProgress.findMany({
            where: { userId },
            skip,
            take: limit,
            orderBy: {
                updatedAt: "desc",
            },
            select: {
                episodeId: true,
                positionInSeconds: true,
                updatedAt: true,
                episode: {
                    select: {
                        id: true,
                        title: true,
                        durationInSeconds: true,
                        episodeNumber: true,
                        show: {
                            select: {
                                id: true,
                                title: true,
                                coverImageUrl: true,
                            },
                        },
                    },
                },
            },
        }),

        prisma.listeningProgress.count({
            where: { userId },
        }),
    ]);

    return {
        history,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}


}