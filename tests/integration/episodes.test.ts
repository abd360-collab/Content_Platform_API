
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { generateAccessToken } from "../../src/modules/auth/jwt.js";

describe("Episode API", () => {
    let adminToken: string;
    let customerToken: string;
    let customerId: string;

    let showId: string;
    let anotherShowId: string;

    const createdEpisodeIds: string[] = [];
    const createdShowIds: string[] = [];
    const createdUserIds: string[] = [];

    // --------------------------------------------------
    // Test helpers
    // --------------------------------------------------

    async function createShow(title: string) {
        const show = await prisma.show.create({
            data: {
                title,
                description: "Integration test show description",
            },
        });

        createdShowIds.push(show.id);
        return show;
    }

    async function createUser(role: "ADMIN" | "CUSTOMER") {
        const user = await prisma.user.create({
            data: {
                name: `${role} ${randomUUID()}`,
                email: `${randomUUID()}@example.com`,
                passwordHash: "test-password-hash",
                role,
            },
        });

        createdUserIds.push(user.id);
        return user;
    }

    async function createEpisode(
        targetShowId: string,
        episodeNumber: number,
    ) {
        const episode = await prisma.episode.create({
            data: {
                showId: targetShowId,
                title: `Episode ${episodeNumber}`,
                description: "Integration test episode description",
                audioUrl: "https://example.com/audio.mp3",
                durationInSeconds: 600,
                episodeNumber,
            },
        });

        createdEpisodeIds.push(episode.id);
        return episode;
    }

    async function createListeningProgress(episodeId: string) {
        return prisma.listeningProgress.create({
            data: {
                userId: customerId,
                episodeId,
                positionInSeconds: 300,
            },
        });
    }

    // --------------------------------------------------
    // Setup and cleanup
    // --------------------------------------------------

    beforeEach(async () => {
        const admin = await createUser("ADMIN");
        const customer = await createUser("CUSTOMER");

        customerId = customer.id;

        adminToken = generateAccessToken({
            sub: admin.id,
            role: "ADMIN",
        });

        customerToken = generateAccessToken({
            sub: customer.id,
            role: "CUSTOMER",
        });

        const show = await createShow("Episode Test Show");
        const anotherShow = await createShow("Another Episode Test Show");

        showId = show.id;
        anotherShowId = anotherShow.id;
    });

    afterEach(async () => {
        await prisma.listeningProgress.deleteMany({
            where: {
                episodeId: { in: createdEpisodeIds },
            },
        });

        await prisma.episode.deleteMany({
            where: {
                id: { in: createdEpisodeIds },
            },
        });

        await prisma.show.deleteMany({
            where: {
                id: { in: createdShowIds },
            },
        });

        await prisma.user.deleteMany({
            where: {
                id: { in: createdUserIds },
            },
        });

        createdEpisodeIds.length = 0;
        createdShowIds.length = 0;
        createdUserIds.length = 0;
    });

    // ==================================================
    // POST: Create episode
    // ==================================================

    describe("POST /api/v1/shows/:showId/episodes", () => {
        it("should allow an admin to create an episode", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${showId}/episodes`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "The Beginning",
                    description: "The first episode of this test show",
                    audioUrl: "https://example.com/episode-1.mp3",
                    durationInSeconds: 1200,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            expect(response.body.data).toMatchObject({
                showId,
                title: "The Beginning",
                description: "The first episode of this test show",
                durationInSeconds: 1200,
                episodeNumber: 1,
            });

            expect(response.body.data.id).toBeDefined();

            createdEpisodeIds.push(response.body.data.id);
        });

        it("should reject unauthenticated requests", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${showId}/episodes`)
                .send({
                    title: "Unauthorized Episode",
                    description: "This episode should not be created",
                    audioUrl: "https://example.com/audio.mp3",
                    durationInSeconds: 600,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(401);
        });

        it("should reject customer access", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${showId}/episodes`)
                .set("Authorization", `Bearer ${customerToken}`)
                .send({
                    title: "Customer Episode",
                    description: "This episode should not be created",
                    audioUrl: "https://example.com/audio.mp3",
                    durationInSeconds: 600,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(403);
        });

        it("should reject invalid episode data", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${showId}/episodes`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "A",
                    description: "Short",
                    audioUrl: "not-a-url",
                    durationInSeconds: -10,
                    episodeNumber: 0,
                });

            expect(response.status).toBe(400);
        });

        it("should reject an invalid show ID", async () => {
            const response = await request(app)
                .post("/api/v1/shows/invalid-id/episodes")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Test Episode",
                    description: "A valid episode description",
                    audioUrl: "https://example.com/audio.mp3",
                    durationInSeconds: 600,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(400);
        });

        it("should return 404 when the show does not exist", async () => {
            const response = await request(app)
                .post(`/api/v1/shows/${randomUUID()}/episodes`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Test Episode",
                    description: "A valid episode description",
                    audioUrl: "https://example.com/audio.mp3",
                    durationInSeconds: 600,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(404);
        });

        it("should reject duplicate episode numbers within the same show", async () => {
            await createEpisode(showId, 1);

            const response = await request(app)
                .post(`/api/v1/shows/${showId}/episodes`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Duplicate Number Episode",
                    description: "This episode has a duplicate number",
                    audioUrl: "https://example.com/audio.mp3",
                    durationInSeconds: 600,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(409);
        });

        it("should allow the same episode number in different shows", async () => {
            await createEpisode(showId, 1);

            const response = await request(app)
                .post(`/api/v1/shows/${anotherShowId}/episodes`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Another Show Episode One",
                    description: "Episode one of another show",
                    audioUrl: "https://example.com/audio.mp3",
                    durationInSeconds: 600,
                    episodeNumber: 1,
                });

            expect(response.status).toBe(201);
            expect(response.body.data.episodeNumber).toBe(1);

            createdEpisodeIds.push(response.body.data.id);
        });
    });

    // ==================================================
    // GET: List episodes
    // ==================================================

    describe("GET /api/v1/shows/:showId/episodes", () => {
        it("should return episodes ordered by episode number", async () => {
            await createEpisode(showId, 3);
            await createEpisode(showId, 1);
            await createEpisode(showId, 2);

            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes`);

            expect(response.status).toBe(200);
            expect(response.body.data.episodes).toHaveLength(3);

            expect(
                response.body.data.episodes.map(
                    (episode: { episodeNumber: number }) => episode.episodeNumber
                )
            ).toEqual([1, 2, 3]);
        });

        it("should return correct pagination metadata", async () => {
            await createEpisode(showId, 1);
            await createEpisode(showId, 2);
            await createEpisode(showId, 3);

            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes?page=1&limit=2`);

            expect(response.status).toBe(200);
            expect(response.body.data.episodes).toHaveLength(2);

            expect(response.body.data.pagination).toEqual({
                page: 1,
                limit: 2,
                total: 3,
                totalPages: 2,
            });
        });

        it("should return an empty list when the show has no episodes", async () => {
            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes`);

            expect(response.status).toBe(200);
            expect(response.body.data.episodes).toEqual([]);
            expect(response.body.data.pagination.total).toBe(0);
        });

        it("should reject an invalid page number", async () => {
            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes?page=0`);

            expect(response.status).toBe(400);
        });

        it("should reject a limit greater than 50", async () => {
            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes?limit=51`);

            expect(response.status).toBe(400);
        });

        it("should return 404 when the show does not exist", async () => {
            const response = await request(app)
                .get(`/api/v1/shows/${randomUUID()}/episodes`);

            expect(response.status).toBe(404);
        });
    });

    // ==================================================
    // GET: Retrieve a single episode
    // ==================================================

    describe("GET /api/v1/shows/:showId/episodes/:episodeId", () => {
        it("should return an episode by its ID", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes/${episode.id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(response.body.data).toMatchObject({
                id: episode.id,
                showId,
                title: "Episode 1",
                description: "Integration test episode description",
                audioUrl: "https://example.com/audio.mp3",
                durationInSeconds: 600,
                episodeNumber: 1,
            });

            expect(response.body.data.createdAt).toBeDefined();
            expect(response.body.data.updatedAt).toBeDefined();
        });

        it("should return 404 when the episode does not exist", async () => {
            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes/${randomUUID()}`);

            expect(response.status).toBe(404);
        });

        it("should return 404 when the episode belongs to another show", async () => {
            const episode = await createEpisode(anotherShowId, 1);

            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes/${episode.id}`);

            expect(response.status).toBe(404);
        });

        it("should reject an invalid show ID", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .get(`/api/v1/shows/invalid-id/episodes/${episode.id}`);

            expect(response.status).toBe(400);
        });

        it("should reject an invalid episode ID", async () => {
            const response = await request(app)
                .get(`/api/v1/shows/${showId}/episodes/invalid-id`);

            expect(response.status).toBe(400);
        });
    });

    // ==================================================
    // PATCH: Update episode
    // ==================================================

    describe("PATCH /api/v1/shows/:showId/episodes/:episodeId", () => {
        it("should allow an admin to update an episode", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Updated Episode Title",
                    description: "Updated episode description",
                    audioUrl: "https://example.com/updated-audio.mp3",
                });

            expect(response.status).toBe(200);

            expect(response.body.data).toMatchObject({
                id: episode.id,
                showId,
                title: "Updated Episode Title",
                description: "Updated episode description",
                audioUrl: "https://example.com/updated-audio.mp3",
            });
        });

        it("should reject unauthenticated requests", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .send({
                    title: "Updated Title",
                });

            expect(response.status).toBe(401);
        });

        it("should reject customer access", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${customerToken}`)
                .send({
                    title: "Updated Title",
                });

            expect(response.status).toBe(403);
        });

        it("should reject invalid update data", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "A",
                    durationInSeconds: -10,
                });

            expect(response.status).toBe(400);
        });

        it("should reject an empty update payload", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});

            expect(response.status).toBe(400);
        });

        it("should return 404 when the episode does not exist", async () => {
            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${randomUUID()}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Updated Title",
                });

            expect(response.status).toBe(404);
        });

        it("should return 404 when the episode belongs to another show", async () => {
            const episode = await createEpisode(anotherShowId, 1);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    title: "Updated Title",
                });

            expect(response.status).toBe(404);
        });

        it("should reject duplicate episode numbers within the same show", async () => {
            const firstEpisode = await createEpisode(showId, 1);
            await createEpisode(showId, 2);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${firstEpisode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    episodeNumber: 2,
                });

            expect(response.status).toBe(409);
        });

        it("should prevent reducing duration when listening progress exists", async () => {
            const episode = await createEpisode(showId, 1);
            await createListeningProgress(episode.id);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    durationInSeconds: 200,
                });

            expect(response.status).toBe(409);
        });

        it("should allow increasing duration when listening progress exists", async () => {
            const episode = await createEpisode(showId, 1);
            await createListeningProgress(episode.id);

            const response = await request(app)
                .patch(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    durationInSeconds: 900,
                });

            expect(response.status).toBe(200);
            expect(response.body.data.durationInSeconds).toBe(900);
        });
    });

    // ==================================================
    // DELETE: Delete episode
    // ==================================================

    describe("DELETE /api/v1/shows/:showId/episodes/:episodeId", () => {
        it("should allow an admin to delete an episode", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .delete(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(200);

            const deletedEpisode = await prisma.episode.findUnique({
                where: { id: episode.id },
            });

            expect(deletedEpisode).toBeNull();
        });

        it("should reject unauthenticated requests", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .delete(`/api/v1/shows/${showId}/episodes/${episode.id}`);

            expect(response.status).toBe(401);
        });

        it("should reject customer access", async () => {
            const episode = await createEpisode(showId, 1);

            const response = await request(app)
                .delete(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(403);
        });

        it("should return 404 when the episode does not exist", async () => {
            const response = await request(app)
                .delete(`/api/v1/shows/${showId}/episodes/${randomUUID()}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
        });

        it("should return 404 when the episode belongs to another show", async () => {
            const episode = await createEpisode(anotherShowId, 1);

            const response = await request(app)
                .delete(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(404);

            const existingEpisode = await prisma.episode.findUnique({
                where: { id: episode.id },
            });

            expect(existingEpisode).not.toBeNull();
        });

        it("should delete associated listening progress when an episode is deleted", async () => {
            const episode = await createEpisode(showId, 1);
            await createListeningProgress(episode.id);

            const response = await request(app)
                .delete(`/api/v1/shows/${showId}/episodes/${episode.id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(200);

            const progress = await prisma.listeningProgress.findUnique({
                where: {
                    userId_episodeId: {
                        userId: customerId,
                        episodeId: episode.id,
                    },
                },
            });

            expect(progress).toBeNull();

            const deletedEpisode = await prisma.episode.findUnique({
                where: { id: episode.id },
            });

            expect(deletedEpisode).toBeNull();
        });
    });
});
