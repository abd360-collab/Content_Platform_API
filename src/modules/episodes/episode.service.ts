
import { EpisodeRepository } from "./episode.repository.js";
import { ShowRepository } from "../shows/show.repository.js";
import { AppError } from "../../common/errors/app-error.js";
import type {
    CreateEpisodeDTO,
    UpdateEpisodeDTO,
} from "./episode.validator.js";

export class EpisodeService {
    constructor(
        private readonly episodeRepository: EpisodeRepository,
        private readonly showRepository: ShowRepository,
    ) {}

    async createEpisode(
        adminId: string,
        showId: string,
        data: CreateEpisodeDTO,
    ) {
        const showExists = await this.showRepository.existsById(showId);

        if (!showExists) {
            throw new AppError(404, "Show not found");
        }

        return this.episodeRepository.create(adminId, showId, data);
    }

    async getEpisodesByShowId(
        showId: string,
        page: number,
        limit: number,
    ) {
        const showExists = await this.showRepository.existsById(showId);

        if (!showExists) {
            throw new AppError(404, "Show not found");
        }

        return this.episodeRepository.findAllByShowId(
            showId,
            page,
            limit,
        );
    }

    async getEpisodeById(showId: string, episodeId: string) {
        const episode = await this.episodeRepository.findById(
            showId,
            episodeId,
        );

        if (!episode) {
            throw new AppError(404, "Episode not found");
        }

        return episode;
    }

    async updateEpisode(
        adminId: string,
        showId: string,
        episodeId: string,
        data: UpdateEpisodeDTO,
    ) {
        const episode = await this.episodeRepository.findById(
            showId,
            episodeId,
        );

        if (!episode) {
            throw new AppError(404, "Episode not found");
        }

        if (data.durationInSeconds !== undefined) {
            const hasProgress = await this.episodeRepository.hasProgress(
                episodeId,
            );

            if (
                hasProgress &&
                data.durationInSeconds < episode.durationInSeconds
            ) {
                throw new AppError(
                    409,
                    "Cannot reduce episode duration after listening progress exists",
                );
            }
        }

        return this.episodeRepository.update(
            adminId,
            showId,
            episodeId,
            data,
        );
    }

    async deleteEpisode(showId: string, episodeId: string) {
        const episode = await this.episodeRepository.findById(
            showId,
            episodeId,
        );

        if (!episode) {
            throw new AppError(404, "Episode not found");
        }

        return this.episodeRepository.delete(showId, episodeId);
    }
}
