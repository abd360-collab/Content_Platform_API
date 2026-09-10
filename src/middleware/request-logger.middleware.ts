import { Request, Response, NextFunction } from "express";
import { getRequestLogger } from "../utils/request-logger.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - start) / 1_000_000;

    getRequestLogger().info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      },
      "Request completed",
    );
  });

  next();
}