
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { generateAccessToken } from "../../src/modules/auth/jwt.js";

describe("Follow API", () => {
    let customerId: string;
    let customerToken: string;

    let anotherCustomerId: string;
    let anotherCustomerToken: string;

    let categoryOneId: string;
    let categoryTwoId: string;
    let categoryThreeId: string;

    let followedShowId: string;
    let recommendationShowId: string;
    let popularShowId: string;
    let secondaryRankShowId: string;
    let unrelatedShowId: string;

    const fixtureToken = randomUUID();

    const createdShowIds: string[] = [];
    const createdCategoryIds: string[] = [];
    const createdUserIds: string[] = [];

    async function createUser() {
        const user = await prisma.user.create({
            data: {
                name: `Follow Test User ${randomUUID()}`,
                email: `follow-${randomUUID()}@example.com`,
                passwordHash: "test-password-hash",
                role: "CUSTOMER",
            },
        });

        createdUserIds.push(user.id);

        return {
            id: user.id,
            token: generateAccessToken({
                sub: user.id,
                role: "CUSTOMER",
            }),
        };
    }

    async function createCategory(name: string) {
        const category = await prisma.category.create({
            data: {
                name: `${name} ${randomUUID()}`,
                slug: `${name.toLowerCase()}-${randomUUID()}`,
            },
        });

        createdCategoryIds.push(category.id);

        return category.id;
    }

    async function createShow(
        title: string,
        categoryIds: string[] = [],
    ) {
        const show = await prisma.show.create({
            data: {
                title: `${title} ${fixtureToken}`,
                description: `Description for ${title} ${fixtureToken}`,
                categories: {
                    create: categoryIds.map((categoryId) => ({
                        category: {
                            connect: {
                                id: categoryId,
                            },
                        },
                    })),
                },
            },
        });

        createdShowIds.push(show.id);

        return show.id;
    }

    async function addFollowers(showId: string, count: number) {
        for (let i = 0; i < count; i++) {
            const user = await createUser();

            await prisma.follow.create({
                data: {
                    userId: user.id,
                    showId,
                },
            });
        }
    }

    async function followAsCustomer(showId: string) {
        return request(app)
            .post(`/api/v1/shows/${showId}/follow`)
            .set("Authorization", `Bearer ${customerToken}`);
    }

    beforeEach(async () => {
        const customer = await createUser();

        customerId = customer.id;
        customerToken = customer.token;

        const anotherCustomer = await createUser();

        anotherCustomerId = anotherCustomer.id;
        anotherCustomerToken = anotherCustomer.token;

        categoryOneId = await createCategory("Drama");
        categoryTwoId = await createCategory("Mystery");
        categoryThreeId = await createCategory("Comedy");

        followedShowId = await createShow(
            "Followed Show",
            [categoryOneId, categoryTwoId],
        );

        recommendationShowId = await createShow(
            "Recommended Multi Category Show",
            [categoryOneId, categoryTwoId],
        );

        popularShowId = await createShow(
            "Popular Single Category Show",
            [categoryOneId],
        );

        secondaryRankShowId = await createShow(
            "Secondary Ranking Show",
            [categoryTwoId],
        );

        unrelatedShowId = await createShow(
            "Unrelated Show",
            [categoryThreeId],
        );
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

    // ---------------------------------------------------------
    // POST /api/v1/shows/:showId/follow
    // ---------------------------------------------------------

    describe("POST /api/v1/shows/:showId/follow", () => {
        it("should follow a show successfully", async () => {
            const response = await followAsCustomer(followedShowId);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            expect(response.body.data).toMatchObject({
                userId: customerId,
                showId: followedShowId,
            });

            const follow = await prisma.follow.findUnique({
                where: {
                    userId_showId: {
                        userId: customerId,
                        showId: followedShowId,
                    },
                },
            });

            expect(follow).not.toBeNull();
        });

        it("should handle repeated follow requests idempotently", async () => {
            const firstResponse = await followAsCustomer(followedShowId);
            const secondResponse = await followAsCustomer(followedShowId);

            expect(firstResponse.status).toBe(201);
            expect(secondResponse.status).toBe(201);

            expect(secondResponse.body.data).toMatchObject({
                userId: customerId,
                showId: followedShowId,
            });

            const count = await prisma.follow.count({
                where: {
                    userId: customerId,
                    showId: followedShowId,
                },
            });

            expect(count).toBe(1);
        });

        it("should allow different users to follow the same show", async () => {
            const firstResponse = await followAsCustomer(followedShowId);

            const secondResponse = await request(app)
                .post(`/api/v1/shows/${followedShowId}/follow`)
                .set("Authorization", `Bearer ${anotherCustomerToken}`);

            expect(firstResponse.status).toBe(201);
            expect(secondResponse.status).toBe(201);

            const count = await prisma.follow.count({
                where: {
                    showId: followedShowId,
                },
            });

            expect(count).toBe(2);
        });

        it("should reject requests without authentication", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${followedShowId}/follow`);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it("should reject an invalid show ID", async () => {
            const response = await request(app)
                .post("/api/v1/shows/invalid-id/follow")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it("should return 404 when the show does not exist", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${randomUUID()}/follow`)
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    // ---------------------------------------------------------
    // DELETE /api/v1/shows/:showId/follow
    // ---------------------------------------------------------

    describe("DELETE /api/v1/shows/:showId/follow", () => {
        it("should unfollow a show successfully", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .delete(`/api/v1/shows/${followedShowId}/follow`)
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(response.body.data.message).toBe(
                "Show unfollowed successfully",
            );

            const follow = await prisma.follow.findUnique({
                where: {
                    userId_showId: {
                        userId: customerId,
                        showId: followedShowId,
                    },
                },
            });

            expect(follow).toBeNull();
        });

        it("should return 404 when the user is not following the show", async () => {
            const response = await request(app)
                .delete(`/api/v1/shows/${followedShowId}/follow`)
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });

        it("should not unfollow another user's follow", async () => {
            await request(app)
                .post(`/api/v1/shows/${followedShowId}/follow`)
                .set("Authorization", `Bearer ${anotherCustomerToken}`);

            const response = await request(app)
                .delete(`/api/v1/shows/${followedShowId}/follow`)
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(404);

            const otherUsersFollow = await prisma.follow.findUnique({
                where: {
                    userId_showId: {
                        userId: anotherCustomerId,
                        showId: followedShowId,
                    },
                },
            });

            expect(otherUsersFollow).not.toBeNull();
        });

        it("should reject requests without authentication", async () => {
            const response = await request(app)
                .delete(`/api/v1/shows/${followedShowId}/follow`);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it("should reject an invalid show ID", async () => {
            const response = await request(app)
                .delete("/api/v1/shows/invalid-id/follow")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    // ---------------------------------------------------------
    // GET /api/v1/shows/me/following
    // ---------------------------------------------------------

    describe("GET /api/v1/shows/me/following", () => {
        it("should return the authenticated user's followed shows", async () => {
            await followAsCustomer(followedShowId);
            await followAsCustomer(popularShowId);

            const response = await request(app)
                .get("/api/v1/shows/me/following")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(response.body.data.shows).toHaveLength(2);

            const returnedIds = response.body.data.shows.map(
                (show: { id: string }) => show.id,
            );

            expect(returnedIds).toContain(followedShowId);
            expect(returnedIds).toContain(popularShowId);

            expect(response.body.data.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1,
            });
        });

        it("should include followedAt for every followed show", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .get("/api/v1/shows/me/following")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);

            const show = response.body.data.shows.find(
                (item: { id: string }) => item.id === followedShowId,
            );

            expect(show.followedAt).toBeDefined();
            expect(Number.isNaN(Date.parse(show.followedAt))).toBe(false);
        });

        it("should include episode and follower counts", async () => {
            await followAsCustomer(followedShowId);
            await addFollowers(followedShowId, 2);

            const response = await request(app)
                .get("/api/v1/shows/me/following")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);

            const show = response.body.data.shows.find(
                (item: { id: string }) => item.id === followedShowId,
            );

            expect(show._count).toMatchObject({
                episodes: 0,
                follows: 3,
            });
        });

        it("should not return shows followed by another user", async () => {
            await request(app)
                .post(`/api/v1/shows/${followedShowId}/follow`)
                .set("Authorization", `Bearer ${anotherCustomerToken}`);

            const response = await request(app)
                .get("/api/v1/shows/me/following")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.shows).toHaveLength(0);
        });

        it("should return an empty list when the user follows no shows", async () => {
            const response = await request(app)
                .get("/api/v1/shows/me/following")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.shows).toEqual([]);

            expect(response.body.data.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
            });
        });

        it("should paginate followed shows", async () => {
            await followAsCustomer(followedShowId);
            await followAsCustomer(popularShowId);

            const response = await request(app)
                .get("/api/v1/shows/me/following?page=1&limit=1")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.shows).toHaveLength(1);

            expect(response.body.data.pagination).toMatchObject({
                page: 1,
                limit: 1,
                total: 2,
                totalPages: 2,
            });
        });

        it("should reject invalid pagination parameters", async () => {
            const response = await request(app)
                .get("/api/v1/shows/me/following?page=0&limit=100")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it("should reject requests without authentication", async () => {
            const response = await request(app)
                .get("/api/v1/shows/me/following");

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    // ---------------------------------------------------------
    // GET /api/v1/users/me/recommendations
    // ---------------------------------------------------------

    describe("GET /api/v1/users/me/recommendations", () => {
        it("should recommend shows based on followed categories", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const returnedIds = response.body.data.shows.map(
                (show: { id: string }) => show.id,
            );

            expect(returnedIds).toContain(recommendationShowId);
            expect(returnedIds).toContain(popularShowId);
            expect(returnedIds).toContain(secondaryRankShowId);
            expect(returnedIds).not.toContain(followedShowId);
            expect(returnedIds).not.toContain(unrelatedShowId);
        });

        it("should exclude shows already followed by the user", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);

            const returnedIds = response.body.data.shows.map(
                (show: { id: string }) => show.id,
            );

            expect(returnedIds).not.toContain(followedShowId);
        });

        it("should rank shows with more matching categories first", async () => {
            await followAsCustomer(followedShowId);

            await addFollowers(popularShowId, 5);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);

            const shows = response.body.data.shows;

            const multiCategoryIndex = shows.findIndex(
                (show: { id: string }) =>
                    show.id === recommendationShowId,
            );

            const popularShowIndex = shows.findIndex(
                (show: { id: string }) =>
                    show.id === popularShowId,
            );

            expect(multiCategoryIndex).not.toBe(-1);
            expect(popularShowIndex).not.toBe(-1);

            expect(multiCategoryIndex).toBeLessThan(popularShowIndex);
        });

        it("should rank by follower count when matching category counts are equal", async () => {
            await followAsCustomer(followedShowId);

            await addFollowers(popularShowId, 5);
            await addFollowers(secondaryRankShowId, 2);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);

            const shows = response.body.data.shows;

            const popularIndex = shows.findIndex(
                (show: { id: string }) =>
                    show.id === popularShowId,
            );

            const secondaryIndex = shows.findIndex(
                (show: { id: string }) =>
                    show.id === secondaryRankShowId,
            );

            expect(popularIndex).not.toBe(-1);
            expect(secondaryIndex).not.toBe(-1);

            expect(popularIndex).toBeLessThan(secondaryIndex);
        });

        it("should return matching category and follower counts", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);

            const show = response.body.data.shows.find(
                (item: { id: string }) =>
                    item.id === recommendationShowId,
            );

            expect(show).toBeDefined();
            expect(show.matchingCategoryCount).toBe(2);
            expect(show.followerCount).toBe(0);
            expect(show.episodeCount).toBe(0);
            expect(show.categories).toHaveLength(2);
        });

        it("should return empty recommendations when the user follows no shows", async () => {
            const response = await request(app)
                .get("/api/v1/users/me/recommendations")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(response.body.data.shows).toEqual([]);

            expect(response.body.data.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
            });
        });

        it("should paginate recommendations", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations?page=1&limit=1")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.shows).toHaveLength(1);

            expect(response.body.data.pagination).toMatchObject({
                page: 1,
                limit: 1,
                total: 3,
                totalPages: 3,
            });
        });

        it("should return an empty page when the requested page exceeds the result count", async () => {
            await followAsCustomer(followedShowId);

            const response = await request(app)
                .get("/api/v1/users/me/recommendations?page=5&limit=10")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.shows).toEqual([]);

            expect(response.body.data.pagination).toMatchObject({
                page: 5,
                limit: 10,
                total: 3,
                totalPages: 1,
            });
        });

        it("should reject invalid pagination parameters", async () => {
            const response = await request(app)
                .get("/api/v1/users/me/recommendations?page=0&limit=100")
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it("should reject requests without authentication", async () => {
            const response = await request(app)
                .get("/api/v1/users/me/recommendations");

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });
});
