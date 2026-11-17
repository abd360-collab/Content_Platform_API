
import { prisma } from "../../config/database.js";
import { AppError } from "../../common/errors/app-error.js";
import type { CreateEpisodeDTO, UpdateEpisodeDTO } from "./episode.validator.js";

export class EpisodeRepository {
    private async attachAudio(
        tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
        adminId: string,
        uploadId: string,
    ): Promise<string> {
        const result = await tx.mediaUpload.updateMany({
            where: {
                id: uploadId,
                userId: adminId,
                mediaType: "EPISODE_AUDIO",
                resourceType: "video",
                status: "VERIFIED",
            },
            data: {
                status: "ATTACHED",
                attachedAt: new Date(),
            },
        });

        if (result.count !== 1) {
            throw new AppError(
                409,
                "Audio upload is invalid, unavailable, or already attached",
            );
        }

        const upload = await tx.mediaUpload.findUnique({
            where: { id: uploadId },
            select: { secureUrl: true },
        });

        if (!upload?.secureUrl) {
            throw new AppError(409, "Verified audio URL is unavailable");
        }

        return upload.secureUrl;
    }

    async create(
        adminId: string,
        showId: string,
        data: CreateEpisodeDTO,
    ) {
        const { audioUploadId, ...episodeData } = data;

        return prisma.$transaction(async (tx) => {
            const audioUrl = await this.attachAudio(
                tx,
                adminId,
                audioUploadId,
            );

            return tx.episode.create({
                data: {
                    showId,
                    ...episodeData,
                    audioUrl,
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

    async update(
        adminId: string,
        showId: string,
        episodeId: string,
        data: UpdateEpisodeDTO,
    ) {
        const { audioUploadId, ...episodeData } = data;

        return prisma.$transaction(async (tx) => {
            let audioUrl: string | undefined;

            if (audioUploadId) {
                audioUrl = await this.attachAudio(
                    tx,
                    adminId,
                    audioUploadId,
                );
            }

            return tx.episode.update({
                where: {
                    id: episodeId,
                    showId,
                },
                data: {
                    ...episodeData,
                    ...(audioUrl && { audioUrl }),
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
        });
    }

    async hasProgress(episodeId: string) {
        const progress = await prisma.listeningProgress.findFirst({
            where: { episodeId },
            select: { userId: true },
        });

        return progress !== null;
    }

    async delete(showId: string, episodeId: string) {
        return prisma.episode.delete({
            where: {
                id: episodeId,
                showId,
            },
            select: {
                id: true,
                showId: true,
                title: true,
                episodeNumber: true,
            },
        });
    }
}
