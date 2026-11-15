import type { Request, Response, NextFunction } from "express";
import { UserRepository } from "../repositories/user.repository.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { UserService } from "../services/user.service.js";
import { ChangePasswordDTO } from "../validators/user.validator.js";

const userRepository = new UserRepository();
const sessionRepository = new SessionRepository();

const userService = new UserService(userRepository, sessionRepository);

export async function getMyProfile(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        if (!req.user) {
            return next(new Error("Authenticated user missing"));
        }

        const user = await userService.getProfile(req.user.id);

        return res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        return next(error);
    }
}

export async function updateMyProfile(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        if (!req.user) {
            return next(new Error("Authenticated user missing"));
        }

        const user = await userService.updateProfile(
            req.user.id,
            req.body,
        );

        return res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        return next(error);
    }
}


export async function changeMyPassword(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        if (!req.user) {
            return next(new Error("Authenticated user missing"));
        }

        const result = await userService.changePassword(
            req.user.id,
            req.body as ChangePasswordDTO,
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}


export async function deleteMyAccount(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        if (!req.user) {
            return next(new Error("Authenticated user missing"));
        }

        const result = await userService.deleteAccount(req.user.id);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}