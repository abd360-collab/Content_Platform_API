import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { requestContext } from "../utils/request-context";

export function requestId(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const id = req.header("x-request-id") ?? randomUUID();

    const requestLogger = logger.child({
        requestId: id,
    });

    res.setHeader("x-request-id", id);

    req.requestId = id;
   
    requestContext.run(
        {
            requestId: id,
            logger: requestLogger,
        },
        next,
    );
}