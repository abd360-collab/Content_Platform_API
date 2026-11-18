
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { cloudinary } from "../../src/config/cloudinary.js";
import { env } from "../../src/config/env.js";
import { hashPassword } from "../../src/modules/auth/password.js";
import { MediaCleanupService } from "../../src/modules/media/media-cleanup.service.js";

const createdUserIds: string[] = [];

const mediaCleanupService = new MediaCleanupService();

const TEST_PASSWORD = "StrongPassword123!";

type TestRole = "ADMIN" | "CUSTOMER";
type TestMediaType = "SHOW_COVER" | "EPISODE_AUDIO";
type TestMediaStatus =
    | "PENDING"
    | "VERIFYING"
    | "VERIFIED"
    | "REJECTED"
    | "ATTACHED"
    | "EXPIRED";

interface TestUser {
    id: string;
    accessToken: string;
}

async function createAuthenticatedUser(
    role: TestRole,
): Promise<TestUser> {
    const email = `${role.toLowerCase()}-${randomUUID()}@example.com`;
    const passwordHash = await hashPassword(TEST_PASSWORD);

    const user = await prisma.user.create({
        data: {
            name: `Media Test ${role}`,
            email,
            passwordHash,
            role,
        },
    });

    createdUserIds.push(user.id);

    const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
            email,
            password: TEST_PASSWORD,
        });

    if (response.status !== 200) {
        throw new Error(
            `Failed to authenticate test ${role.toLowerCase()}`,
        );
    }

    return {
        id: user.id,
        accessToken: response.body.data.accessToken as string,
    };
}

async function createMediaUpload(
    userId: string,
    overrides: {
        mediaType?: TestMediaType;
        status?: TestMediaStatus;
        publicId?: string;
        resourceType?: string;
        expiresAt?: Date;
        updatedAt?: Date;
        secureUrl?: string | null;
        format?: string | null;
        bytes?: number | null;
        verifiedAt?: Date | null;
        attachedAt?: Date | null;
    } = {},
) {
    const mediaType = overrides.mediaType ?? "SHOW_COVER";

    return prisma.mediaUpload.create({
        data: {
            userId,
            mediaType,
            publicId:
                overrides.publicId ??
                `test-${randomUUID()}`,
            resourceType:
                overrides.resourceType ??
                (mediaType === "SHOW_COVER" ? "image" : "video"),
            status: overrides.status ?? "PENDING",
            expiresAt:
                overrides.expiresAt ??
                new Date(Date.now() + 60 * 60 * 1000),
            ...(overrides.updatedAt
                ? { updatedAt: overrides.updatedAt }
                : {}),
            ...(overrides.secureUrl !== undefined
                ? { secureUrl: overrides.secureUrl }
                : {}),
            ...(overrides.format !== undefined
                ? { format: overrides.format }
                : {}),
            ...(overrides.bytes !== undefined
                ? { bytes: overrides.bytes }
                : {}),
            ...(overrides.verifiedAt !== undefined
                ? { verifiedAt: overrides.verifiedAt }
                : {}),
            ...(overrides.attachedAt !== undefined
                ? { attachedAt: overrides.attachedAt }
                : {}),
        },
    });
}

function validCloudinaryResource(
    upload: {
        publicId: string;
        mediaType: TestMediaType;
    },
) {
    const isShowCover = upload.mediaType === "SHOW_COVER";

    return {
        public_id: upload.publicId,
        resource_type: isShowCover ? "image" : "video",
        format: isShowCover ? "jpg" : "mp3",
        bytes: isShowCover ? 1024 * 1024 : 5 * 1024 * 1024,
        secure_url: "https://res.cloudinary.com/test/image/upload/test",
    };
}

describe("Media module integration tests", () => {
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

    afterEach(async () => {
        vi.restoreAllMocks();

        if (createdUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: [...createdUserIds],
                    },
                },
            });

            createdUserIds.length = 0;
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // ---------------------------------------------------------
    // UPLOAD SIGNATURE
    // ---------------------------------------------------------

    describe("POST /api/v1/media/upload-signature", () => {
        it("should generate a SHOW_COVER upload signature", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            vi.spyOn(
                cloudinary.utils,
                "api_sign_request",
            ).mockReturnValue("test-signature");

            const response = await request(app)
                .post("/api/v1/media/upload-signature")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    mediaType: "SHOW_COVER",
                });

            expect(response.status).toBe(200);

            expect(response.body.data).toMatchObject({
                signature: "test-signature",
                apiKey: env.CLOUDINARY_API_KEY,
                cloudName: env.CLOUDINARY_CLOUD_NAME,
                uploadPreset: env.CLOUDINARY_SHOW_COVER_PRESET,
                resourceType: "image",
                allowedFormats: [
                    "jpg",
                    "jpeg",
                    "png",
                    "webp",
                ],
                maxFileSize: 5 * 1024 * 1024,
                overwrite: false,
            });

            const upload = await prisma.mediaUpload.findUnique({
                where: {
                    id: response.body.data.uploadId,
                },
            });

            expect(upload).not.toBeNull();
            expect(upload).toMatchObject({
                userId: admin.id,
                mediaType: "SHOW_COVER",
                resourceType: "image",
                status: "PENDING",
            });

            expect(upload!.publicId).toMatch(/^show_cover-/);

            expect(upload!.expiresAt.getTime()).toBeGreaterThan(
                Date.now(),
            );

            expect(upload!.expiresAt.getTime()).toBeLessThanOrEqual(
                Date.now() + 60 * 60 * 1000 + 5000,
            );
        });

        it("should generate an EPISODE_AUDIO upload signature", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            vi.spyOn(
                cloudinary.utils,
                "api_sign_request",
            ).mockReturnValue("test-audio-signature");

            const response = await request(app)
                .post("/api/v1/media/upload-signature")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    mediaType: "EPISODE_AUDIO",
                });

            expect(response.status).toBe(200);

            expect(response.body.data).toMatchObject({
                signature: "test-audio-signature",
                apiKey: env.CLOUDINARY_API_KEY,
                cloudName: env.CLOUDINARY_CLOUD_NAME,
                uploadPreset: env.CLOUDINARY_EPISODE_AUDIO_PRESET,
                resourceType: "video",
                allowedFormats: [
                    "mp3",
                    "m4a",
                    "aac",
                    "wav",
                    "ogg",
                ],
                maxFileSize: 50 * 1024 * 1024,
                overwrite: false,
            });

            const upload = await prisma.mediaUpload.findUnique({
                where: {
                    id: response.body.data.uploadId,
                },
            });

            expect(upload).toMatchObject({
                userId: admin.id,
                mediaType: "EPISODE_AUDIO",
                resourceType: "video",
                status: "PENDING",
            });

            expect(upload!.publicId).toMatch(/^episode_audio-/);
        });

        it("should reject unauthenticated requests", async () => {
            const response = await request(app)
                .post("/api/v1/media/upload-signature")
                .send({
                    mediaType: "SHOW_COVER",
                });

            expect(response.status).toBe(401);
        });

        it("should reject CUSTOMER users", async () => {
            const customer =
                await createAuthenticatedUser("CUSTOMER");

            const response = await request(app)
                .post("/api/v1/media/upload-signature")
                .set(
                    "Authorization",
                    `Bearer ${customer.accessToken}`,
                )
                .send({
                    mediaType: "SHOW_COVER",
                });

            expect(response.status).toBe(403);
        });

        it("should reject an invalid media type", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const response = await request(app)
                .post("/api/v1/media/upload-signature")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    mediaType: "INVALID_TYPE",
                });

            expect(response.status).toBe(400);
        });

        it("should reject a missing media type", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const response = await request(app)
                .post("/api/v1/media/upload-signature")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({});

            expect(response.status).toBe(400);
        });
    });

    // ---------------------------------------------------------
    // VERIFY UPLOAD
    // ---------------------------------------------------------

    describe("POST /api/v1/media/verify-upload", () => {
        it("should reject unauthenticated requests", async () => {
            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .send({
                    uploadId: randomUUID(),
                });

            expect(response.status).toBe(401);
        });

        it("should reject CUSTOMER users", async () => {
            const customer =
                await createAuthenticatedUser("CUSTOMER");

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${customer.accessToken}`,
                )
                .send({
                    uploadId: randomUUID(),
                });

            expect(response.status).toBe(403);
        });

        it("should reject an invalid upload ID", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: "invalid-uuid",
                });

            expect(response.status).toBe(400);
        });

        it("should reject a missing upload ID", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({});

            expect(response.status).toBe(400);
        });

        it("should return 404 when the upload does not exist", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: randomUUID(),
                });

            expect(response.status).toBe(404);
        });

        it("should return 404 when another admin owns the upload", async () => {
            const admin = await createAuthenticatedUser("ADMIN");
            const anotherAdmin =
                await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                anotherAdmin.id,
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(404);

            const unchangedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(unchangedUpload.status).toBe("PENDING");
        });

        it("should verify a valid SHOW_COVER upload", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(admin.id);

            const resource = validCloudinaryResource({
                publicId: upload.publicId,
                mediaType: "SHOW_COVER",
            });

            vi.spyOn(
                cloudinary.api,
                "resource",
            ).mockResolvedValue(resource as never);

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(200);

            expect(response.body.data).toMatchObject({
                uploadId: upload.id,
                publicId: upload.publicId,
                secureUrl: resource.secure_url,
                format: "jpg",
                bytes: resource.bytes,
                mediaType: "SHOW_COVER",
                status: "VERIFIED",
            });

            const updatedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(updatedUpload).toMatchObject({
                status: "VERIFIED",
                secureUrl: resource.secure_url,
                format: "jpg",
                bytes: resource.bytes,
            });

            expect(updatedUpload.verifiedAt).not.toBeNull();

            expect(
                cloudinary.api.resource,
            ).toHaveBeenCalledWith(
                upload.publicId,
                {
                    resource_type: "image",
                    type: "upload",
                },
            );
        });

        it("should verify a valid EPISODE_AUDIO upload", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    mediaType: "EPISODE_AUDIO",
                },
            );

            const resource = validCloudinaryResource({
                publicId: upload.publicId,
                mediaType: "EPISODE_AUDIO",
            });

            vi.spyOn(
                cloudinary.api,
                "resource",
            ).mockResolvedValue(resource as never);

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(200);

            expect(response.body.data).toMatchObject({
                uploadId: upload.id,
                publicId: upload.publicId,
                format: "mp3",
                mediaType: "EPISODE_AUDIO",
                status: "VERIFIED",
            });

            const updatedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(updatedUpload.status).toBe("VERIFIED");

            expect(
                cloudinary.api.resource,
            ).toHaveBeenCalledWith(
                upload.publicId,
                {
                    resource_type: "video",
                    type: "upload",
                },
            );
        });

        it("should return an already VERIFIED upload without contacting Cloudinary again", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    status: "VERIFIED",
                    secureUrl:
                        "https://res.cloudinary.com/test/verified.jpg",
                    format: "jpg",
                    bytes: 1024,
                    verifiedAt: new Date(),
                },
            );

            const resourceSpy = vi.spyOn(
                cloudinary.api,
                "resource",
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(200);

            expect(response.body.data).toMatchObject({
                uploadId: upload.id,
                status: "VERIFIED",
                format: "jpg",
                bytes: 1024,
            });

            expect(resourceSpy).not.toHaveBeenCalled();
        });

        it("should reject an upload whose verification is already in progress", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    status: "VERIFYING",
                },
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(409);
        });

        it("should reject an upload that has already been rejected", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    status: "REJECTED",
                },
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(422);
        });

        it("should reject an expired upload", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    expiresAt: new Date(Date.now() - 60_000),
                },
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(410);

            const updatedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(updatedUpload.status).toBe("EXPIRED");
        });

        it("should reject an upload already marked EXPIRED", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    status: "EXPIRED",
                    expiresAt: new Date(Date.now() - 60_000),
                },
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(410);
        });

        it("should reject an upload that has already been attached", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(
                admin.id,
                {
                    status: "ATTACHED",
                    secureUrl:
                        "https://res.cloudinary.com/test/attached.jpg",
                    format: "jpg",
                    bytes: 1024,
                    verifiedAt: new Date(),
                    attachedAt: new Date(),
                },
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(409);
        });

        it("should return 404 and reset to PENDING when Cloudinary cannot find the asset", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(admin.id);

            vi.spyOn(
                cloudinary.api,
                "resource",
            ).mockRejectedValue({
                http_code: 404,
            });

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(404);

            const updatedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(updatedUpload.status).toBe("PENDING");
        });

        it("should return 502 and reset to PENDING when Cloudinary has a temporary failure", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(admin.id);

            vi.spyOn(
                cloudinary.api,
                "resource",
            ).mockRejectedValue(
                new Error("Cloudinary unavailable"),
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(502);

            const updatedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(updatedUpload.status).toBe("PENDING");
        });

        it.each([
            {
                name: "public ID mismatch",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.public_id = "different-public-id";
                },
            },
            {
                name: "resource type mismatch",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.resource_type = "video";
                },
            },
            {
                name: "unsupported format",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.format = "gif";
                },
            },
            {
                name: "file larger than the permitted limit",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.bytes = 6 * 1024 * 1024;
                },
            },
            {
                name: "zero-byte file",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.bytes = 0;
                },
            },
            {
                name: "non-integer file size",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.bytes = 1.5;
                },
            },
            {
                name: "non-HTTPS URL",
                modify: (resource: ReturnType<typeof validCloudinaryResource>) => {
                    resource.secure_url = "http://example.com/file.jpg";
                },
            },
        ])(
            "should reject an invalid Cloudinary asset: $name",
            async ({ modify }) => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(admin.id);

                const resource = validCloudinaryResource({
                    publicId: upload.publicId,
                    mediaType: "SHOW_COVER",
                });

                modify(resource);

                vi.spyOn(
                    cloudinary.api,
                    "resource",
                ).mockResolvedValue(resource as never);

                const destroySpy = vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                ).mockResolvedValue({
                    result: "ok",
                } as never);

                const response = await request(app)
                    .post("/api/v1/media/verify-upload")
                    .set(
                        "Authorization",
                        `Bearer ${admin.accessToken}`,
                    )
                    .send({
                        uploadId: upload.id,
                    });

                expect(response.status).toBe(422);

                const updatedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(updatedUpload.status).toBe("REJECTED");

                expect(destroySpy).toHaveBeenCalledWith(
                    upload.publicId,
                    {
                        resource_type: "image",
                        type: "upload",
                    },
                );
            },
        );

        it("should remain rejected even if Cloudinary asset deletion fails", async () => {
            const admin = await createAuthenticatedUser("ADMIN");

            const upload = await createMediaUpload(admin.id);

            const resource = validCloudinaryResource({
                publicId: upload.publicId,
                mediaType: "SHOW_COVER",
            });

            resource.format = "gif";

            vi.spyOn(
                cloudinary.api,
                "resource",
            ).mockResolvedValue(resource as never);

            vi.spyOn(
                cloudinary.uploader,
                "destroy",
            ).mockRejectedValue(
                new Error("Cloudinary deletion failed"),
            );

            const response = await request(app)
                .post("/api/v1/media/verify-upload")
                .set(
                    "Authorization",
                    `Bearer ${admin.accessToken}`,
                )
                .send({
                    uploadId: upload.id,
                });

            expect(response.status).toBe(422);

            const updatedUpload =
                await prisma.mediaUpload.findUniqueOrThrow({
                    where: {
                        id: upload.id,
                    },
                });

            expect(updatedUpload.status).toBe("REJECTED");
        });
    });

    // ---------------------------------------------------------
    // MEDIA CLEANUP SERVICE
    // ---------------------------------------------------------

    describe("MediaCleanupService", () => {
        describe("recoverStaleVerifications", () => {
            it("should return stale, unexpired verifications to PENDING", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const staleUpdatedAt = new Date(
                    Date.now() - 15 * 60 * 1000,
                );

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "VERIFYING",
                        expiresAt: new Date(
                            Date.now() + 60 * 60 * 1000,
                        ),
                        updatedAt: staleUpdatedAt,
                    },
                );

                await mediaCleanupService.recoverStaleVerifications();

                const updatedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(updatedUpload.status).toBe("PENDING");
            });

            it("should mark stale verifications as EXPIRED when authorization has expired", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const staleUpdatedAt = new Date(
                    Date.now() - 15 * 60 * 1000,
                );

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "VERIFYING",
                        expiresAt: new Date(
                            Date.now() - 60 * 1000,
                        ),
                        updatedAt: staleUpdatedAt,
                    },
                );

                await mediaCleanupService.recoverStaleVerifications();

                const updatedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(updatedUpload.status).toBe("EXPIRED");
            });

            it("should not recover recent VERIFYING uploads", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "VERIFYING",
                        expiresAt: new Date(
                            Date.now() + 60 * 60 * 1000,
                        ),
                        updatedAt: new Date(),
                    },
                );

                await mediaCleanupService.recoverStaleVerifications();

                const unchangedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(unchangedUpload.status).toBe("VERIFYING");
            });
        });

        describe("expirePendingUploads", () => {
            it("should mark expired PENDING uploads as EXPIRED", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "PENDING",
                        expiresAt: new Date(
                            Date.now() - 60 * 1000,
                        ),
                    },
                );

                await mediaCleanupService.expirePendingUploads();

                const updatedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(updatedUpload.status).toBe("EXPIRED");
            });

            it("should not expire PENDING uploads whose authorization is still valid", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "PENDING",
                        expiresAt: new Date(
                            Date.now() + 60 * 60 * 1000,
                        ),
                    },
                );

                await mediaCleanupService.expirePendingUploads();

                const unchangedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(unchangedUpload.status).toBe("PENDING");
            });

            it("should not change the status of non-PENDING uploads", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "VERIFIED",
                        expiresAt: new Date(
                            Date.now() - 60 * 1000,
                        ),
                        secureUrl:
                            "https://res.cloudinary.com/test/verified.jpg",
                        format: "jpg",
                        bytes: 1024,
                        verifiedAt: new Date(),
                    },
                );

                await mediaCleanupService.expirePendingUploads();

                const unchangedUpload =
                    await prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(unchangedUpload.status).toBe("VERIFIED");
            });
        });

        describe("cleanupRejectedUploads", () => {
            it("should attempt Cloudinary cleanup for rejected uploads older than 24 hours", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 25 * 60 * 60 * 1000,
                        ),
                    },
                );

                const destroySpy = vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                ).mockResolvedValue({
                    result: "ok",
                } as never);

                await mediaCleanupService.cleanupRejectedUploads();

                expect(destroySpy).toHaveBeenCalledWith(
                    upload.publicId,
                    {
                        resource_type: "image",
                        type: "upload",
                    },
                );
            });

            it("should not attempt cleanup for rejected uploads younger than 24 hours", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                await createMediaUpload(
                    admin.id,
                    {
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 23 * 60 * 60 * 1000,
                        ),
                    },
                );

                const destroySpy = vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                );

                await mediaCleanupService.cleanupRejectedUploads();

                expect(destroySpy).not.toHaveBeenCalled();
            });

            it("should attempt cleanup using the upload's resource type", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        mediaType: "EPISODE_AUDIO",
                        resourceType: "video",
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 25 * 60 * 60 * 1000,
                        ),
                    },
                );

                const destroySpy = vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                ).mockResolvedValue({
                    result: "ok",
                } as never);

                await mediaCleanupService.cleanupRejectedUploads();

                expect(destroySpy).toHaveBeenCalledWith(
                    upload.publicId,
                    {
                        resource_type: "video",
                        type: "upload",
                    },
                );
            });

            it("should continue processing when Cloudinary cleanup fails", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const firstUpload = await createMediaUpload(
                    admin.id,
                    {
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 25 * 60 * 60 * 1000,
                        ),
                    },
                );

                const secondUpload = await createMediaUpload(
                    admin.id,
                    {
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 25 * 60 * 60 * 1000,
                        ),
                    },
                );

                const destroySpy = vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                );

                destroySpy
                    .mockRejectedValueOnce(
                        new Error("Cloudinary unavailable"),
                    )
                    .mockResolvedValueOnce({
                        result: "ok",
                    } as never);

                await expect(
                    mediaCleanupService.cleanupRejectedUploads(),
                ).resolves.toBeUndefined();

                expect(destroySpy).toHaveBeenCalledTimes(2);

                expect(destroySpy).toHaveBeenNthCalledWith(
                    1,
                    firstUpload.publicId,
                    {
                        resource_type: "image",
                        type: "upload",
                    },
                );

                expect(destroySpy).toHaveBeenNthCalledWith(
                    2,
                    secondUpload.publicId,
                    {
                        resource_type: "image",
                        type: "upload",
                    },
                );
            });

            it("should retain rejected database records after Cloudinary cleanup", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const upload = await createMediaUpload(
                    admin.id,
                    {
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 25 * 60 * 60 * 1000,
                        ),
                    },
                );

                vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                ).mockResolvedValue({
                    result: "ok",
                } as never);

                await mediaCleanupService.cleanupRejectedUploads();

                const retainedUpload =
                    await prisma.mediaUpload.findUnique({
                        where: {
                            id: upload.id,
                        },
                    });

                expect(retainedUpload).not.toBeNull();
                expect(retainedUpload!.status).toBe("REJECTED");
            });
        });

        describe("run", () => {
            it("should execute all cleanup operations", async () => {
                const admin =
                    await createAuthenticatedUser("ADMIN");

                const staleUpdatedAt = new Date(
                    Date.now() - 15 * 60 * 1000,
                );

                const staleVerification = await createMediaUpload(
                    admin.id,
                    {
                        status: "VERIFYING",
                        expiresAt: new Date(
                            Date.now() + 60 * 60 * 1000,
                        ),
                        updatedAt: staleUpdatedAt,
                    },
                );

                const expiredPending = await createMediaUpload(
                    admin.id,
                    {
                        status: "PENDING",
                        expiresAt: new Date(
                            Date.now() - 60 * 1000,
                        ),
                    },
                );

                const rejectedUpload = await createMediaUpload(
                    admin.id,
                    {
                        status: "REJECTED",
                        updatedAt: new Date(
                            Date.now() - 25 * 60 * 60 * 1000,
                        ),
                    },
                );

                const destroySpy = vi.spyOn(
                    cloudinary.uploader,
                    "destroy",
                ).mockResolvedValue({
                    result: "ok",
                } as never);

                await mediaCleanupService.run();

                const [recovered, expired] = await Promise.all([
                    prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: staleVerification.id,
                        },
                    }),
                    prisma.mediaUpload.findUniqueOrThrow({
                        where: {
                            id: expiredPending.id,
                        },
                    }),
                ]);

                expect(recovered.status).toBe("PENDING");
                expect(expired.status).toBe("EXPIRED");

                expect(destroySpy).toHaveBeenCalledWith(
                    rejectedUpload.publicId,
                    {
                        resource_type: "image",
                        type: "upload",
                    },
                );
            });
        });
    });
});
