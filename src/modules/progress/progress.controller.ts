import type { Request, Response, NextFunction } from "express";
import { ProgressRepository } from "./progress.repository.js";
import { ProgressService } from "./progress.service.js";
import type {
    EpisodeProgressParamsDTO,
    ListProgressDTO,
    SaveProgressDTO,
} from "./progress.validator.js";

const progressRepository = new ProgressRepository();
const progressService = new ProgressService(progressRepository);

export async function saveProgress(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { episodeId } =
            res.locals["params"] as EpisodeProgressParamsDTO;

        const data = res.locals["body"] as SaveProgressDTO;

        const result = await progressService.saveProgress(
            req.user!.id,
            episodeId,
            data,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getProgress(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { episodeId } =
            res.locals["params"] as EpisodeProgressParamsDTO;

        const result = await progressService.getProgress(
            req.user!.id,
            episodeId,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}


export async function getUserHistory(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { page, limit } =
            res.locals["query"] as ListProgressDTO;

        const result = await progressService.getUserHistory(
            req.user!.id,
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

export async function deleteProgress(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { episodeId } =
            res.locals["params"] as EpisodeProgressParamsDTO;

        const result = await progressService.deleteProgress(
            req.user!.id,
            episodeId,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function deleteAllProgress(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await progressService.deleteAllProgress(
            req.user!.id,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}