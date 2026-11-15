
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ZodError } from "zod";
import { mapPrismaError } from "../common/mappers/prisma-error.mapper";
import { getRequestLogger } from "../common/logging/request-logger";

function isMalformedJsonError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const candidate = error as {
        type?: string;
    };

    return candidate.type === "entity.parse.failed";
}

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
) {
    // Let Express handle errors if response headers were already sent.
    if (res.headersSent) {
        next(err);
        return;
    }

    // Convert known Prisma errors into application errors.
    const mappedPrismaError = mapPrismaError(err);

    if (mappedPrismaError) {
        err = mappedPrismaError;
    }

    // Malformed JSON sent by the client.
    if (isMalformedJsonError(err)) {
        res.status(400).json({
            success: false,
            message: "Invalid JSON request body",
            requestId: req.requestId,
        });
        return;
    }

    // Expected application errors.
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            requestId: req.requestId,
        });
        return;
    }

    // Request validation errors.
    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: err.flatten().fieldErrors,
            requestId: req.requestId,
        });
        return;
    }

    // Unexpected errors: log details internally, not in the response.
    getRequestLogger().error(
        {
            err,
            requestId: req.requestId,
        },
        "Unhandled application error",
    );

    res.status(500).json({
        success: false,
        message: "Internal server error",
        requestId: req.requestId,
    });
}
