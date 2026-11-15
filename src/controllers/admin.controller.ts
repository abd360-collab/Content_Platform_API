import type { Request, Response, NextFunction } from "express";
import { AdminRepository } from "../repositories/admin.repository.js";
import { AdminService } from "../services/admin.service.js";
import { ListUsersDTO } from "../validators/admin.validator.js";

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);

export async function getDashboardStats(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const result = await adminService.getDashboardStats();

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}

export async function getUsers(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const query = res.locals["query"] as ListUsersDTO;

        const result = await adminService.getUsers(query);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return next(error);
    }
}