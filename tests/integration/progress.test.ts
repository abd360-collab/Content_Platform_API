
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { generateAccessToken } from "../../src/modules/auth/jwt.js";
import {
    ProgressRepository,
} from "../../src/modules/progress/progress.repository.js";
import {
    ProgressService,
} from "../../src/modules/progress/progress.service.js";

const progressRepository = new ProgressRepository();
const progressService = new ProgressService(progressRepository);

const createdUserIds: string[] = [];
const createdShowIds: string[] = [];
const createdEpisodeIds: string[] = [];

let userId: string;
let anotherUserId: string;

let token: string;
let anotherUserToken: string;

let showId: string;
let anotherShowId: string;

let episodeId: string;
let anotherEpisodeId: string;

const BASE_URL = "/api/v1/episodes";

async function createUser(role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
    const user = await prisma.user.create({
        data: {
            name: "Progress Test User",
            email: `progress-${randomUUID()}@example.com`,
            passwordHash: "test-password-hash",
            role,
        },
    });

    createdUserIds.push(user.id);

    return user;
}

async function createShow() {
    const show = await prisma.show.create({
        data: {
            title: `Progress Test Show ${randomUUID()}`,
            description: "A test show for listening progress integration tests.",
        },
    });

    createdShowIds.push(show.id);

    return show;
}

async function createEpisode(
    targetShowId: string,
    episodeNumber = 1,
    durationInSeconds = 600,
) {
    const episode = await prisma.episode.create({
        data: {
            showId: targetShowId,
            title: `Progress Test Episode ${randomUUID()}`,
            description: "An episode created for progress integration tests.",
            audioUrl: "https://example.com/audio/test-episode.mp3",
            durationInSeconds,
            episodeNumber,
        },
    });

    createdEpisodeIds.push(episode.id);

    return episode;
}

async function createProgress(
    targetUserId: string,
    targetEpisodeId: string,
    positionInSeconds: number,
    updatedAt?: Date,
) {
    return prisma.listeningProgress.create({
        data: {
            userId: targetUserId,
            episodeId: targetEpisodeId,
            positionInSeconds,
            ...(updatedAt ? { updatedAt } : {}),
        },
    });
}

function authHeader(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

beforeEach(async () => {
    const user = await createUser();
    const anotherUser = await createUser();

    userId = user.id;
    anotherUserId = anotherUser.id;

    token = generateAccessToken({
        sub: user.id,
        role: user.role,
    });

    anotherUserToken = generateAccessToken({
        sub: anotherUser.id,
        role: anotherUser.role,
    });

    const show = await createShow();
    const anotherShow = await createShow();

    showId = show.id;
    anotherShowId = anotherShow.id;

    const episode = await createEpisode(show.id);
    const anotherEpisode = await createEpisode(anotherShow.id);

    episodeId = episode.id;
    anotherEpisodeId = anotherEpisode.id;
});

afterEach(async () => {
    if (createdUserIds.length > 0 || createdEpisodeIds.length > 0) {
        await prisma.listeningProgress.deleteMany({
            where: {
                OR: [
                    ...(createdUserIds.length > 0
                        ? [{ userId: { in: createdUserIds } }]
                        : []),
                    ...(createdEpisodeIds.length > 0
                        ? [{ episodeId: { in: createdEpisodeIds } }]
                        : []),
                ],
            },
        });
    }

    if (createdEpisodeIds.length > 0) {
        await prisma.episode.deleteMany({
            where: {
                id: { in: createdEpisodeIds },
            },
        });
    }

    if (createdShowIds.length > 0) {
        await prisma.show.deleteMany({
            where: {
                id: { in: createdShowIds },
            },
        });
    }

    if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
            where: {
                id: { in: createdUserIds },
            },
        });
    }

    createdEpisodeIds.length = 0;
    createdShowIds.length = 0;
    createdUserIds.length = 0;
});


// ============================================================
// PUT /api/v1/episodes/:episodeId/progress
// ============================================================

describe("PUT /api/v1/episodes/:episodeId/progress", () => {
    it("should save listening progress for an authenticated user", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 120,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(response.body.data).toMatchObject({
            userId,
            episodeId,
            positionInSeconds: 120,
        });

        const savedProgress = await prisma.listeningProgress.findUnique({
            where: {
                userId_episodeId: {
                    userId,
                    episodeId,
                },
            },
        });

        expect(savedProgress?.positionInSeconds).toBe(120);
    });

    it("should update existing listening progress instead of creating a duplicate", async () => {
        await createProgress(userId, episodeId, 100);

        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 250,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(response.body.data.positionInSeconds).toBe(250);

        const records = await prisma.listeningProgress.findMany({
            where: {
                userId,
                episodeId,
            },
        });

        expect(records).toHaveLength(1);
        expect(records[0].positionInSeconds).toBe(250);
    });

    it("should allow saving progress at zero seconds", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 0,
            });

        expect(response.status).toBe(200);
        expect(response.body.data.positionInSeconds).toBe(0);
    });

    it("should allow saving progress exactly at episode duration", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 600,
            });

        expect(response.status).toBe(200);
        expect(response.body.data.positionInSeconds).toBe(600);
    });

    it("should reject progress exceeding episode duration", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 601,
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
    });

    it("should reject negative listening positions", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: -10,
            });

        expect(response.status).toBe(400);
    });

    it("should reject decimal listening positions", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 10.5,
            });

        expect(response.status).toBe(400);
    });

    it("should reject non-numeric listening positions", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: "120",
            });

        expect(response.status).toBe(400);
    });

    it("should reject missing listening position", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({});

        expect(response.status).toBe(400);
    });

    it("should reject an invalid episode UUID", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/invalid-id/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 100,
            });

        expect(response.status).toBe(400);
    });

    it("should return 404 when the episode does not exist", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${randomUUID()}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 100,
            });

        expect(response.status).toBe(404);
    });

    it("should reject unauthenticated requests", async () => {
        const response = await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .send({
                positionInSeconds: 100,
            });

        expect(response.status).toBe(401);
    });

    it("should keep progress separate for different users", async () => {
        await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token))
            .send({
                positionInSeconds: 100,
            });

        await request(app)
            .put(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(anotherUserToken))
            .send({
                positionInSeconds: 300,
            });

        const firstUserProgress = await prisma.listeningProgress.findUnique({
            where: {
                userId_episodeId: {
                    userId,
                    episodeId,
                },
            },
        });

        const secondUserProgress = await prisma.listeningProgress.findUnique({
            where: {
                userId_episodeId: {
                    userId: anotherUserId,
                    episodeId,
                },
            },
        });

        expect(firstUserProgress?.positionInSeconds).toBe(100);
        expect(secondUserProgress?.positionInSeconds).toBe(300);
    });
});


// ============================================================
// GET /api/v1/episodes/:episodeId/progress
// ============================================================

describe("GET /api/v1/episodes/:episodeId/progress", () => {
    it("should return the authenticated user's listening progress", async () => {
        await createProgress(userId, episodeId, 180);

        const response = await request(app)
            .get(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(response.body.data).toMatchObject({
            episodeId,
            positionInSeconds: 180,
            episode: {
                id: episodeId,
                durationInSeconds: 600,
                episodeNumber: 1,
                show: {
                    id: showId,
                },
            },
        });
    });

    it("should return null when the user has not saved progress", async () => {
        const response = await request(app)
            .get(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeNull();
    });

    it("should not expose another user's listening progress", async () => {
        await createProgress(userId, episodeId, 200);

        const response = await request(app)
            .get(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(anotherUserToken));

        expect(response.status).toBe(200);
        expect(response.body.data).toBeNull();
    });

    it("should return 404 when the episode does not exist", async () => {
        const response = await request(app)
            .get(`${BASE_URL}/${randomUUID()}/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(404);
    });

    it("should reject invalid episode UUIDs", async () => {
        const response = await request(app)
            .get(`${BASE_URL}/invalid-id/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(400);
    });

    it("should reject unauthenticated requests", async () => {
        const response = await request(app)
            .get(`${BASE_URL}/${episodeId}/progress`);

        expect(response.status).toBe(401);
    });
});


// ============================================================
// DELETE /api/v1/episodes/:episodeId/progress
// ============================================================

describe("DELETE /api/v1/episodes/:episodeId/progress", () => {
    it("should delete the authenticated user's listening progress", async () => {
        await createProgress(userId, episodeId, 200);

        const response = await request(app)
            .delete(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(response.body.data).toMatchObject({
            message: "Listening progress deleted successfully",
        });

        const deletedProgress = await prisma.listeningProgress.findUnique({
            where: {
                userId_episodeId: {
                    userId,
                    episodeId,
                },
            },
        });

        expect(deletedProgress).toBeNull();
    });

    it("should not delete another user's listening progress", async () => {
        await createProgress(userId, episodeId, 200);

        const response = await request(app)
            .delete(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(anotherUserToken));

        expect(response.status).toBe(404);

        const existingProgress = await prisma.listeningProgress.findUnique({
            where: {
                userId_episodeId: {
                    userId,
                    episodeId,
                },
            },
        });

        expect(existingProgress?.positionInSeconds).toBe(200);
    });

    it("should return 404 when listening progress does not exist", async () => {
        const response = await request(app)
            .delete(`${BASE_URL}/${episodeId}/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(404);
    });

    it("should return 404 when the episode does not exist", async () => {
        const response = await request(app)
            .delete(`${BASE_URL}/${randomUUID()}/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(404);
    });

    it("should reject invalid episode UUIDs", async () => {
        const response = await request(app)
            .delete(`${BASE_URL}/invalid-id/progress`)
            .set(authHeader(token));

        expect(response.status).toBe(400);
    });

    it("should reject unauthenticated requests", async () => {
        const response = await request(app)
            .delete(`${BASE_URL}/${episodeId}/progress`);

        expect(response.status).toBe(401);
    });
});


// ============================================================
// GET USER HISTORY - SERVICE BEHAVIOR
// ============================================================

describe("ProgressService.getUserHistory", () => {
    it("should return the authenticated user's listening history", async () => {
        await createProgress(userId, episodeId, 100);
        await createProgress(userId, anotherEpisodeId, 200);

        const result = await progressService.getUserHistory(
            userId,
            1,
            10,
        );

        expect(result.history).toHaveLength(2);

        expect(result.history.map((item) => item.episodeId)).toEqual(
            expect.arrayContaining([episodeId, anotherEpisodeId]),
        );

        expect(result.pagination).toMatchObject({
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
        });
    });

    it("should not include another user's listening history", async () => {
        await createProgress(userId, episodeId, 100);
        await createProgress(anotherUserId, anotherEpisodeId, 200);

        const result = await progressService.getUserHistory(
            userId,
            1,
            10,
        );

        expect(result.history).toHaveLength(1);
        expect(result.history[0].episodeId).toBe(episodeId);
        expect(result.pagination.total).toBe(1);
    });

    it("should return an empty history when the user has no progress", async () => {
        const result = await progressService.getUserHistory(
            userId,
            1,
            10,
        );

        expect(result.history).toHaveLength(0);

        expect(result.pagination).toMatchObject({
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
        });
    });

    it("should paginate listening history correctly", async () => {
        const thirdEpisode = await createEpisode(showId, 3);
        const fourthEpisode = await createEpisode(showId, 4);

        await createProgress(userId, episodeId, 100);
        await createProgress(userId, anotherEpisodeId, 200);
        await createProgress(userId, thirdEpisode.id, 300);
        await createProgress(userId, fourthEpisode.id, 400);

        const firstPage = await progressService.getUserHistory(
            userId,
            1,
            2,
        );

        const secondPage = await progressService.getUserHistory(
            userId,
            2,
            2,
        );

        expect(firstPage.history).toHaveLength(2);
        expect(secondPage.history).toHaveLength(2);

        expect(firstPage.pagination).toMatchObject({
            page: 1,
            limit: 2,
            total: 4,
            totalPages: 2,
        });

        expect(secondPage.pagination).toMatchObject({
            page: 2,
            limit: 2,
            total: 4,
            totalPages: 2,
        });

        const firstPageIds = firstPage.history.map(
            (item) => item.episodeId,
        );

        const secondPageIds = secondPage.history.map(
            (item) => item.episodeId,
        );

        expect(firstPageIds).not.toEqual(secondPageIds);
    });

    it("should order history by most recently updated progress", async () => {
        const olderDate = new Date("2026-01-01T10:00:00.000Z");
        const newerDate = new Date("2026-01-02T10:00:00.000Z");

        await createProgress(
            userId,
            episodeId,
            100,
            olderDate,
        );

        await createProgress(
            userId,
            anotherEpisodeId,
            200,
            newerDate,
        );

        const result = await progressService.getUserHistory(
            userId,
            1,
            10,
        );

        expect(result.history[0].episodeId).toBe(anotherEpisodeId);
        expect(result.history[1].episodeId).toBe(episodeId);
    });

    it("should include episode and show details in listening history", async () => {
        await createProgress(userId, episodeId, 150);

        const result = await progressService.getUserHistory(
            userId,
            1,
            10,
        );

        expect(result.history[0]).toMatchObject({
            episodeId,
            positionInSeconds: 150,
            episode: {
                id: episodeId,
                durationInSeconds: 600,
                episodeNumber: 1,
                show: {
                    id: showId,
                },
            },
        });
    });
});


// ============================================================
// DELETE ALL LISTENING HISTORY - SERVICE BEHAVIOR
// ============================================================

describe("ProgressService.deleteAllProgress", () => {
    it("should delete all listening progress belonging to the user", async () => {
        await createProgress(userId, episodeId, 100);
        await createProgress(userId, anotherEpisodeId, 200);

        const result = await progressService.deleteAllProgress(userId);

        expect(result).toMatchObject({
            deletedCount: 2,
            message: "Listening history cleared successfully",
        });

        const remainingProgress = await prisma.listeningProgress.findMany({
            where: {
                userId,
            },
        });

        expect(remainingProgress).toHaveLength(0);
    });

    it("should not delete another user's listening history", async () => {
        await createProgress(userId, episodeId, 100);
        await createProgress(anotherUserId, anotherEpisodeId, 200);

        const result = await progressService.deleteAllProgress(userId);

        expect(result.deletedCount).toBe(1);

        const otherUserProgress = await prisma.listeningProgress.findUnique({
            where: {
                userId_episodeId: {
                    userId: anotherUserId,
                    episodeId: anotherEpisodeId,
                },
            },
        });

        expect(otherUserProgress?.positionInSeconds).toBe(200);
    });

    it("should succeed when the user has no listening history", async () => {
        const result = await progressService.deleteAllProgress(userId);

        expect(result).toMatchObject({
            deletedCount: 0,
            message: "Listening history cleared successfully",
        });
    });
});
