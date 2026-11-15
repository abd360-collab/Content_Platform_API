import type { Request, Response, NextFunction } from "express";

import { ShowRepository } from "../repositories/show.repository.js";
import { ShowService } from "../services/show.service.js";
import type { CreateShowDTO, ShowIdDTO, UpdateShowDTO } from "../validators/show.validator.js";

const showRepository = new ShowRepository();
const showService = new ShowService(showRepository);

export async function createShow(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const show = await showService.createShow(
            req.body as CreateShowDTO,
        );

        return res.status(201).json({
            success: true,
            data: show,
        });
    } catch (error) {
        return next(error);
    }
}

import type { ListShowsDTO } from "../validators/show.validator.js";

export async function getAllShows(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await showService.getAllShows(
            res.locals["validatedQuery"] as ListShowsDTO,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getShowById(
    req: Request,
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
    req: Request,
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
    req: Request,
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