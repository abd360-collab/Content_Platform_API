
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

describe("Show discovery API", () => {
    let categoryOneId: string;
    let categoryTwoId: string;

    let alphaShowId: string;
    let betaShowId: string;
    let gammaShowId: string;

    const fixtureToken = randomUUID();

    const createdShowIds: string[] = [];
    const createdCategoryIds: string[] = [];
    const createdUserIds: string[] = [];

    async function createShow(
        title: string,
        description: string,
        createdAt: Date,
        categoryId?: string,
    ) {
        const show = await prisma.show.create({
            data: {
                title,
                description,
                createdAt,
            },
        });

        createdShowIds.push(show.id);

        if (categoryId) {
            await prisma.showCategory.create({
                data: {
                    showId: show.id,
                    categoryId,
                },
            });
        }

        return show;
    }

    async function addFollowers(showId: string, count: number) {
        for (let i = 0; i < count; i++) {
            const user = await prisma.user.create({
                data: {
                    name: `Follower ${randomUUID()}`,
                    email: `follower-${randomUUID()}@example.com`,
                    passwordHash: "test-password-hash",
                },
            });

            createdUserIds.push(user.id);

            await prisma.follow.create({
                data: {
                    userId: user.id,
                    showId,
                },
            });
        }
    }

    beforeEach(async () => {
        const categoryOne = await prisma.category.create({
            data: {
                name: `Category One ${randomUUID()}`,
                slug: `category-one-${randomUUID()}`,
            },
        });

        const categoryTwo = await prisma.category.create({
            data: {
                name: `Category Two ${randomUUID()}`,
                slug: `category-two-${randomUUID()}`,
            },
        });

        categoryOneId = categoryOne.id;
        categoryTwoId = categoryTwo.id;

        createdCategoryIds.push(categoryOneId, categoryTwoId);

        alphaShowId = (
            await createShow(
                `Alpha ${fixtureToken} Discovery Show`,
                `A story about mystery and adventure ${fixtureToken}`,
                new Date("2026-01-01T10:00:00.000Z"),
                categoryOneId,
            )
        ).id;

        betaShowId = (
            await createShow(
                `Beta ${fixtureToken} Romance Show`,
                `A romantic story about two people ${fixtureToken}`,
                new Date("2026-02-01T10:00:00.000Z"),
                categoryTwoId,
            )
        ).id;

        gammaShowId = (
            await createShow(
                `Gamma ${fixtureToken} Adventure Show`,
                `An exciting journey through unknown places ${fixtureToken}`,
                new Date("2026-03-01T10:00:00.000Z"),
                categoryOneId,
            )
        ).id;
    });

    afterEach(async () => {
        await prisma.show.deleteMany({
            where: {
                id: {
                    in: createdShowIds,
                },
            },
        });

        await prisma.category.deleteMany({
            where: {
                id: {
                    in: createdCategoryIds,
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: {
                    in: createdUserIds,
                },
            },
        });

        createdShowIds.length = 0;
        createdCategoryIds.length = 0;
        createdUserIds.length = 0;
    });

    describe("GET /api/v1/shows", () => {
        it("should return shows with pagination metadata", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?search=${fixtureToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(response.body.data.shows).toHaveLength(3);

            expect(response.body.data.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 3,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            });
        });

        it("should paginate shows correctly", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?search=${fixtureToken}&page=2&limit=2`);

            expect(response.status).toBe(200);

            expect(response.body.data.shows).toHaveLength(1);

            expect(response.body.data.pagination).toMatchObject({
                page: 2,
                limit: 2,
                total: 3,
                totalPages: 2,
                hasNextPage: false,
                hasPreviousPage: true,
            });
        });

        it("should search shows by title without case sensitivity", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?search=ALPHA ${fixtureToken.toUpperCase()}`);

            expect(response.status).toBe(200);

            expect(response.body.data.shows).toHaveLength(1);
            expect(response.body.data.shows[0].id).toBe(alphaShowId);
        });

        it("should search shows by description", async () => {
            const response = await request(app)
                .get(
                    `/api/v1/shows?search=mystery and adventure ${fixtureToken}`,
                );

            expect(response.status).toBe(200);

            expect(response.body.data.shows).toHaveLength(1);
            expect(response.body.data.shows[0].id).toBe(alphaShowId);
        });

        it("should filter shows by category", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?categoryId=${categoryOneId}`);

            expect(response.status).toBe(200);

            const returnedIds = response.body.data.shows.map(
                (show: { id: string }) => show.id,
            );

            expect(returnedIds).toHaveLength(2);
            expect(returnedIds).toContain(alphaShowId);
            expect(returnedIds).toContain(gammaShowId);
            expect(returnedIds).not.toContain(betaShowId);
        });

        it("should sort shows by newest first", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?search=${fixtureToken}&sortBy=newest`);

            expect(response.status).toBe(200);

            const returnedIds = response.body.data.shows.map(
                (show: { id: string }) => show.id,
            );

            expect(returnedIds).toEqual([
                gammaShowId,
                betaShowId,
                alphaShowId,
            ]);
        });

        it("should sort shows by oldest first", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?search=${fixtureToken}&sortBy=oldest`);

            expect(response.status).toBe(200);

            const returnedIds = response.body.data.shows.map(
                (show: { id: string }) => show.id,
            );

            expect(returnedIds).toEqual([
                alphaShowId,
                betaShowId,
                gammaShowId,
            ]);
        });

        it("should sort shows by popularity", async () => {
            await addFollowers(alphaShowId, 1);
            await addFollowers(betaShowId, 3);

            const response = await request(app)
                .get(`/api/v1/shows?search=${fixtureToken}&sortBy=popular`);

            expect(response.status).toBe(200);

            const shows = response.body.data.shows;

            expect(shows.map((show: { id: string }) => show.id)).toEqual([
                betaShowId,
                alphaShowId,
                gammaShowId,
            ]);

            expect(shows[0].followerCount).toBe(3);
            expect(shows[1].followerCount).toBe(1);
            expect(shows[2].followerCount).toBe(0);
        });

        it("should combine search, category filtering, and sorting", async () => {
            const response = await request(app)
                .get(
                    `/api/v1/shows?search=unknown&categoryId=${categoryOneId}&sortBy=newest`,
                );

            expect(response.status).toBe(200);

            expect(response.body.data.shows).toHaveLength(1);
            expect(response.body.data.shows[0].id).toBe(gammaShowId);
        });

        it("should reject invalid pagination parameters", async () => {
            const response = await request(app)
                .get("/api/v1/shows?page=0&limit=100");

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it("should reject an invalid sort option", async () => {
            const response = await request(app)
                .get("/api/v1/shows?sortBy=invalid");

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it("should reject an invalid category ID", async () => {
            const response = await request(app)
                .get("/api/v1/shows?categoryId=invalid-id");

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it("should return 404 when the category does not exist", async () => {
            const response = await request(app)
                .get(`/api/v1/shows?categoryId=${randomUUID()}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe("GET /api/v1/shows/trending", () => {
        it("should return trending shows ordered by follower count", async () => {
            await addFollowers(alphaShowId, 1);
            await addFollowers(betaShowId, 3);

            const response = await request(app)
                .get("/api/v1/shows/trending?limit=50");

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const shows = response.body.data.shows;

            const fixtureShows = shows.filter(
                (show: { id: string }) =>
                    [alphaShowId, betaShowId, gammaShowId].includes(show.id),
            );

            expect(fixtureShows).toHaveLength(3);

            expect(fixtureShows.map((show: { id: string }) => show.id)).toEqual([
                betaShowId,
                alphaShowId,
                gammaShowId,
            ]);

            expect(fixtureShows[0].followerCount).toBe(3);
            expect(fixtureShows[0].episodeCount).toBe(0);
        });
    });
});
