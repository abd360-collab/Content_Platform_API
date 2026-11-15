import type { Request, Response, NextFunction } from "express";

import { EpisodeRepository } from "../repositories/episode.repository.js";
import { ShowRepository } from "../repositories/show.repository.js";
import { EpisodeService } from "../services/episode.service.js";

import type { CreateEpisodeDTO, EpisodeParamsDTO, ListEpisodesDTO } from "../validators/episode.validator.js";
import type { ShowIdDTO } from "../validators/show.validator.js";

const episodeRepository = new EpisodeRepository();
const showRepository = new ShowRepository();

const episodeService = new EpisodeService(
    episodeRepository,
    showRepository,
);

export async function createEpisode(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;
        const data = res.locals["body"] as CreateEpisodeDTO;

        const episode = await episodeService.createEpisode(
            showId,
            data,
        );

        return res.status(201).json({
            success: true,
            data: episode,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getEpisodesByShowId(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;
        const { page, limit } = res.locals["query"] as ListEpisodesDTO;

        const result = await episodeService.getEpisodesByShowId(
            showId,
            page,
            limit,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getEpisodeById(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId, episodeId } =
            res.locals["params"] as EpisodeParamsDTO;

        const episode = await episodeService.getEpisodeById(
            showId,
            episodeId,
        );

        return res.status(200).json({
            success: true,
            data: episode,
        });
    } catch (error) {
        return next(error);
    }
}