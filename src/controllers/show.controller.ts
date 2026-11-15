
import type { Request, Response, NextFunction } from "express";

import { ShowRepository } from "../repositories/show.repository.js";
import { ShowService } from "../services/show.service.js";

import type {
    CreateShowDTO,
    ListShowsDTO,
    ListTrendingShowsDTO,
    ShowIdDTO,
    UpdateShowDTO,
} from "../validators/show.validator.js";

const showRepository = new ShowRepository();
const showService = new ShowService(showRepository);

export async function createShow(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const data = res.locals["body"] as CreateShowDTO;

        const show = await showService.createShow(data);

        return res.status(201).json({
            success: true,
            data: show,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getAllShows(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const query = res.locals["query"] as ListShowsDTO;

        const result = await showService.getAllShows(query);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getShowById(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;

        const show = await showService.getShowById(showId);

        return res.status(200).json({
            success: true,
            data: show,
        });
    } catch (error) {
        return next(error);
    }
}

export async function updateShow(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;
        const data = res.locals["body"] as UpdateShowDTO;

        const show = await showService.updateShow(showId, data);

        return res.status(200).json({
            success: true,
            data: show,
        });
    } catch (error) {
        return next(error);
    }
}

export async function deleteShow(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { showId } = res.locals["params"] as ShowIdDTO;

        const result = await showService.deleteShow(showId);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}


export async function getTrendingShows(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const query = res.locals["query"] as ListTrendingShowsDTO;

        const result = await showService.getTrendingShows(query);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}
