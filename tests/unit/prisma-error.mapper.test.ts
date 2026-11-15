
import { describe, it, expect } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { mapPrismaError } from "../../src/utils/prisma-error.mapper";
import { AppError } from "../../src/utils/app-error";

describe("mapPrismaError", () => {
    function createPrismaError(code: string) {
        return new Prisma.PrismaClientKnownRequestError(
            "Test Prisma error",
            {
                code,
                clientVersion: "test",
            },
        );
    }

    it("should return null for a non-Prisma error", () => {
        const error = new Error("Some unexpected error");

        const result = mapPrismaError(error);

        expect(result).toBeNull();
    });

    it("should map P2002 to a 409 conflict error", () => {
        const result = mapPrismaError(createPrismaError("P2002"));

        expect(result).toBeInstanceOf(AppError);
        expect(result?.statusCode).toBe(409);
        expect(result?.message).toBe(
            "A record with this value already exists",
        );
    });

    it("should map P2025 to a 404 not found error", () => {
        const result = mapPrismaError(createPrismaError("P2025"));

        expect(result).toBeInstanceOf(AppError);
        expect(result?.statusCode).toBe(404);
        expect(result?.message).toBe(
            "The requested record was not found",
        );
    });

    it("should map P2003 to a 409 constraint error", () => {
        const result = mapPrismaError(createPrismaError("P2003"));

        expect(result).toBeInstanceOf(AppError);
        expect(result?.statusCode).toBe(409);
        expect(result?.message).toBe(
            "The operation violates a related record constraint",
        );
    });

    it("should return null for an unhandled Prisma error code", () => {
        const result = mapPrismaError(createPrismaError("P1000"));

        expect(result).toBeNull();
    });
});
