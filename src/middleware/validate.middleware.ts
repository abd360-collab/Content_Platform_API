
import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

type RequestSource = "body" | "query" | "params";

export function validate(
    schema: ZodSchema,
    source: RequestSource = "body",
) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            return next(result.error);
        }

        res.locals[source] = result.data;

        if (source === "body") {
            req.body = result.data;
        }

        return next();
    };
}
