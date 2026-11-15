import { ProgressRepository } from "../repositories/progress.repository.js";
import { AppError } from "../utils/app-error.js";
import type { SaveProgressDTO } from "../validators/progress.validator.js";
import { prisma } from "../config/database.js";

export class ProgressService {
    constructor(
        private readonly progressRepository: ProgressRepository,
    ) {}

    async saveProgress(
        userId: string,
        episodeId: string,
        data: SaveProgressDTO,
    ) {
        const episode = await prisma.episode.findUnique({
            where: { id: episodeId },
            select: {
                id: true,
                durationInSeconds: true,
            },
        });

        if (!episode) {
            throw new AppError(404, "Episode not found");
        }

        if (data.positionInSeconds > episode.durationInSeconds) {
            throw new AppError(
                400,
                "Listening position cannot exceed episode duration",
            );
        }

        return this.progressRepository.saveProgress(
            userId,
            episodeId,
            data,
        );
    }

    async getProgress(userId: string, episodeId: string) {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: { id: true },
    });

    if (!episode) {
        throw new AppError(404, "Episode not found");
    }

    const progress = await this.progressRepository.findProgress(
        userId,
        episodeId,
    );

    return progress;
}

async getUserHistory(
    userId: string,
    page: number,
    limit: number,
) {
    return this.progressRepository.findUserHistory(
        userId,
        page,
        limit,
    );
}

async deleteProgress(userId: string, episodeId: string) {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: { id: true },
    });

    if (!episode) {
        throw new AppError(404, "Episode not found");
    }

    const deletedCount = await this.progressRepository.deleteProgress(
        userId,
        episodeId,
    );

    if (deletedCount === 0) {
        throw new AppError(404, "Listening progress not found");
    }

    return {
        message: "Listening progress deleted successfully",
    };
}

async deleteAllProgress(userId: string) {
    const deletedCount = await this.progressRepository.deleteAllProgress(
        userId,
    );

    return {
        deletedCount,
        message: "Listening history cleared successfully",
    };
}
}