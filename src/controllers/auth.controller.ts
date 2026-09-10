import { Request, Response, NextFunction } from "express";
import { UserRepository } from "../repositories/user.repository";
import { UserService } from "../services/user.service";
import { success } from "zod";
import { SessionRepository } from "../repositories/session.repository";

const userRepository = new UserRepository();
const sessionRepository = new SessionRepository();

const userService = new UserService(userRepository, sessionRepository);

export async function register(
    req: Request,
    res: Response,
    next: NextFunction,
) {
   try {
     const user = await userService.register(req.body);

    res.status(201).json({
        success: true,
        data: user,
    });
   }
   catch (error) {
    next(error);
   }
}

export async function login(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await userService.login(req.body);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}


export async function refresh(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await userService.refresh(req.body);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}