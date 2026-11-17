
import { beforeAll, afterAll } from "vitest";
import { prisma } from "../src/config/database";

beforeAll(async () => {
    if (process.env.NODE_ENV !== "test") {
        throw new Error(
            "Tests must run with NODE_ENV=test",
        );
    }

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error("DATABASE_URL is missing");
    }

    const databaseName = new URL(databaseUrl).pathname.slice(1);

    if (databaseName !== "content_platform_test") {
        throw new Error(
            `Refusing to run tests against database: ${databaseName}`,
        );
    }

    

    await prisma.$connect();
});

afterAll(async () => {
    await prisma.$disconnect();
});
