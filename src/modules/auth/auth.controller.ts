
import type { Request, Response, NextFunction } from "express";

import { UserRepository } from "../users/user.repository";
import { SessionRepository } from "./session.repository";
import { UserService } from "../users/user.service";

const userRepository = new UserRepository();
const sessionRepository = new SessionRepository();

const userService = new UserService(
    userRepository,
    sessionRepository,
);

export async function register(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const user = await userService.register(req.body);

        return res.status(201).json({
            success: true,
            data: user,
        });
    } catch (error) {
        return next(error);
    }
}

export async function login(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await userService.login(req.body);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function refresh(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await userService.refresh(req.body);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function logout(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await userService.logout(req.body);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}




export async function logoutAll(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        if (!req.user) {
            return next(new Error("Authenticated user missing"));
        }

        const result = await userService.logoutAll(req.user.id);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}
