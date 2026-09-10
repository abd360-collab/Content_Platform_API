import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error";
import { ZodError } from "zod";
import { mapPrismaError } from "../utils/prisma-error.mapper";
import { getRequestLogger } from "../utils/request-logger";

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {

     const mappedPrismaError = mapPrismaError(err);

    if (mappedPrismaError) {
        err = mappedPrismaError;
    }
    if(err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
        return;
    }

    if(err instanceof ZodError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.flatten().fieldErrors,
        });
        return;
    }



   getRequestLogger().error(
    {
        err,
        requestId: _req.requestId,
    },

    "Unhandled application error",
   );

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
}