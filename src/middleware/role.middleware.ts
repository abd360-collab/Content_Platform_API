import type { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";


type UserRole = NonNullable<Request["user"]>["role"];

export function requireRole(...allowedRoles: UserRole[]) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    // Authentication must happen before authorization.
    if (!req.user) {
      return next(new AppError(401, "Authentication required"));
    }

    // Check whether the authenticated user's role is permitted.
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission to access this resource"));
    }

    return next();
  };
}