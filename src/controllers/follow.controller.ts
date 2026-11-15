import type { Request, Response, NextFunction } from "express";
import { FollowRepository } from "../repositories/follow.repository.js";
import { ShowRepository } from "../repositories/show.repository.js";
import { FollowService } from "../services/follow.service.js";
import type { ListShowsDTO, ShowIdDTO } from "../validators/show.validator.js";

const followRepository = new FollowRepository();
const showRepository = new ShowRepository();

const followService = new FollowService(
    followRepository,
    showRepository,
);

export async function followShow(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;
        const userId = req.user!.id;

        const result = await followService.followShow(userId, showId);

        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function unfollowShow(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;
        const userId = req.user!.id;

        const result = await followService.unfollowShow(userId, showId);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getFollowedShows(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const userId = req.user!.id;
        const { page, limit } = res.locals["query"] as ListShowsDTO;

        const result = await followService.getFollowedShows(
            userId,
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