
import { Prisma } from "../generated/prisma/client";
import { AppError } from "./app-error";

export function mapPrismaError(error: unknown): AppError | null {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        return null;
    }

    switch (error.code) {
        case "P2002":
            return new AppError(
                409,
                "A record with this value already exists",
            );

        case "P2025":
            return new AppError(
                404,
                "The requested record was not found",
            );

        case "P2003":
            return new AppError(
                409,
                "The operation violates a related record constraint",
            );

        default:
            return null;
    }
}
