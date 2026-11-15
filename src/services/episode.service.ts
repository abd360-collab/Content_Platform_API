import { EpisodeRepository } from "../repositories/episode.repository.js";
import { ShowRepository } from "../repositories/show.repository.js";
import { AppError } from "../utils/app-error.js";
import type { CreateEpisodeDTO } from "../validators/episode.validator.js";

export class EpisodeService {
    constructor(
        private readonly episodeRepository: EpisodeRepository,
        private readonly showRepository: ShowRepository,
    ) {}

    async createEpisode(showId: string, data: CreateEpisodeDTO) {
        const showExists = await this.showRepository.existsById(showId);

        if (!showExists) {
            throw new AppError(404, "Show not found");
        }

        return this.episodeRepository.create(showId, data);
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
}