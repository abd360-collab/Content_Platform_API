
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

describe("Category API", () => {
    let adminToken: string;
    let customerToken: string;

    const createdCategoryIds: string[] = [];
    const createdShowIds: string[] = [];
    const createdUserIds: string[] = [];

    async function createUser(role: "ADMIN" | "CUSTOMER") {
        const user = await prisma.user.create({
            data: {
                email: `${randomUUID()}@test.com`,
                name: `Test ${role}`,
                passwordHash: "test-password-hash",
                role,
            },
        });

        createdUserIds.push(user.id);
        return user;
    }

    async function createCategory(
        name: string,
        slug: string,
        description?: string,
    ) {
        const category = await prisma.category.create({
            data: {
                name,
                slug,
                ...(description !== undefined && { description }),
            },
        });

        createdCategoryIds.push(category.id);
        return category;
    }

    async function createShow(title: string) {
        const show = await prisma.show.create({
            data: {
                title,
                description: "Test show description",
            },
        });

        createdShowIds.push(show.id);
        return show;
    }

    beforeEach(async () => {
        const admin = await createUser("ADMIN");
        const customer = await createUser("CUSTOMER");

        adminToken = generateAccessToken({
            sub: admin.id,
            role: "ADMIN",
        });

        customerToken = generateAccessToken({
            sub: customer.id,
            role: "CUSTOMER",
        });
    });

    afterEach(async () => {
        if (createdShowIds.length > 0) {
            await prisma.show.deleteMany({
                where: { id: { in: createdShowIds } },
            });
            createdShowIds.length = 0;
        }

        if (createdCategoryIds.length > 0) {
            await prisma.category.deleteMany({
                where: { id: { in: createdCategoryIds } },
            });
            createdCategoryIds.length = 0;
        }

        if (createdUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: { id: { in: createdUserIds } },
            });
            createdUserIds.length = 0;
        }
    });

    describe("GET /api/v1/categories", () => {
        it("should list categories publicly", async () => {
            await createCategory("Mystery", `mystery-${randomUUID()}`);
            await createCategory("Romance", `romance-${randomUUID()}`);

            const response = await request(app)
                .get("/api/v1/categories");

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.categories.length).toBeGreaterThanOrEqual(2);
            expect(response.body.data.pagination).toBeDefined();
        });

        it("should support pagination", async () => {
            await createCategory("Alpha", `alpha-${randomUUID()}`);
            await createCategory("Beta", `beta-${randomUUID()}`);
            await createCategory("Gamma", `gamma-${randomUUID()}`);

            const response = await request(app)
                .get("/api/v1/categories?page=1&limit=2");

            expect(response.status).toBe(200);
            expect(response.body.data.categories).toHaveLength(2);
            expect(response.body.data.pagination.page).toBe(1);
            expect(response.body.data.pagination.limit).toBe(2);
        });

        it("should search categories by name", async () => {
            const unique = randomUUID();

            await createCategory(
                `Mystery ${unique}`,
                `mystery-${unique}`,
            );

            const response = await request(app)
                .get(`/api/v1/categories?search=Mystery ${unique}`);

            expect(response.status).toBe(200);
            expect(response.body.data.categories).toHaveLength(1);
        });

        it("should search categories by slug", async () => {
            const unique = randomUUID().replaceAll("-", "");

            await createCategory(
                "Adventure",
                `adventure-${unique}`,
            );

            const response = await request(app)
                .get(`/api/v1/categories?search=adventure-${unique}`);

            expect(response.status).toBe(200);
            expect(response.body.data.categories).toHaveLength(1);
        });

        it("should reject invalid pagination", async () => {
            const response = await request(app)
                .get("/api/v1/categories?page=0&limit=100");

            expect(response.status).toBe(400);
        });

        it("should reject invalid search length", async () => {
            const response = await request(app)
                .get(`/api/v1/categories?search=${"a".repeat(101)}`);

            expect(response.status).toBe(400);
        });
    });

    describe("GET /api/v1/categories/:categoryId", () => {
        it("should return category details", async () => {
            const category = await createCategory(
                "Thriller",
                `thriller-${randomUUID()}`,
                "Suspenseful stories",
            );

            const response = await request(app)
                .get(`/api/v1/categories/${category.id}`);

            expect(response.status).toBe(200);
            expect(response.body.data.id).toBe(category.id);
            expect(response.body.data.name).toBe("Thriller");
            expect(response.body.data.shows).toEqual([]);
            expect(response.body.data._count.shows).toBe(0);
        });

        it("should include associated shows", async () => {
            const category = await createCategory(
                "Fantasy",
                `fantasy-${randomUUID()}`,
            );

            const show = await createShow("Fantasy Show");

            await prisma.showCategory.create({
                data: {
                    showId: show.id,
                    categoryId: category.id,
                },
            });

            const response = await request(app)
                .get(`/api/v1/categories/${category.id}`);

            expect(response.status).toBe(200);
            expect(response.body.data.shows).toHaveLength(1);
            expect(response.body.data.shows[0].show.id).toBe(show.id);
            expect(response.body.data._count.shows).toBe(1);
        });

        it("should return 404 for a nonexistent category", async () => {
            const response = await request(app)
                .get(`/api/v1/categories/${randomUUID()}`);

            expect(response.status).toBe(404);
        });

        it("should reject an invalid category UUID", async () => {
            const response = await request(app)
                .get("/api/v1/categories/not-a-uuid");

            expect(response.status).toBe(400);
        });
    });

    describe("POST /api/v1/categories", () => {
        it("should allow an admin to create a category", async () => {
            const unique = randomUUID().replaceAll("-", "");

            const response = await request(app)
                .post("/api/v1/categories")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    name: `Science Fiction ${unique}`,
                    slug: `science-fiction-${unique}`,
                    description: "Futuristic stories",
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(`Science Fiction ${unique}`);

            createdCategoryIds.push(response.body.data.id);
        });

        it("should reject unauthenticated requests", async () => {
            const response = await request(app)
                .post("/api/v1/categories")
                .send({
                    name: "Mystery",
                    slug: "mystery",
                });

            expect(response.status).toBe(401);
        });

        it("should reject customer access", async () => {
            const response = await request(app)
                .post("/api/v1/categories")
                .set("Authorization", `Bearer ${customerToken}`)
                .send({
                    name: "Mystery",
                    slug: "mystery",
                });

            expect(response.status).toBe(403);
        });

        it("should reject invalid category data", async () => {
            const response = await request(app)
                .post("/api/v1/categories")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    name: "A",
                    slug: "INVALID SLUG",
                });

            expect(response.status).toBe(400);
        });

        it("should reject duplicate category names", async () => {
            const name = `Mystery ${randomUUID()}`;

            await createCategory(name, `mystery-${randomUUID()}`);

            const response = await request(app)
                .post("/api/v1/categories")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    name,
                    slug: `another-${randomUUID()}`,
                });

            expect(response.status).toBe(409);
        });

        it("should reject duplicate category slugs", async () => {
            const slug = `mystery-${randomUUID()}`;

            await createCategory("Mystery", slug);

            const response = await request(app)
                .post("/api/v1/categories")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    name: `Other ${randomUUID()}`,
                    slug,
                });

            expect(response.status).toBe(409);
        });
    });

    describe("PATCH /api/v1/categories/:categoryId", () => {
        it("should allow an admin to update a category", async () => {
            const category = await createCategory(
                "Old Name",
                `old-name-${randomUUID()}`,
            );

            const response = await request(app)
                .patch(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    name: "Updated Name",
                    description: "Updated description",
                });

            expect(response.status).toBe(200);
            expect(response.body.data.name).toBe("Updated Name");
            expect(response.body.data.description).toBe("Updated description");
        });

        it("should allow clearing the description with null", async () => {
            const category = await createCategory(
                "Documentary",
                `documentary-${randomUUID()}`,
                "Old description",
            );

            const response = await request(app)
                .patch(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ description: null });

            expect(response.status).toBe(200);
            expect(response.body.data.description).toBeNull();
        });

        it("should reject an empty update body", async () => {
            const category = await createCategory(
                "Drama",
                `drama-${randomUUID()}`,
            );

            const response = await request(app)
                .patch(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});

            expect(response.status).toBe(400);
        });

        it("should reject customer access", async () => {
            const category = await createCategory(
                "History",
                `history-${randomUUID()}`,
            );

            const response = await request(app)
                .patch(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${customerToken}`)
                .send({ name: "Updated History" });

            expect(response.status).toBe(403);
        });

        it("should return 404 for a nonexistent category", async () => {
            const response = await request(app)
                .patch(`/api/v1/categories/${randomUUID()}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Updated Name" });

            expect(response.status).toBe(404);
        });

        it("should reject duplicate names during update", async () => {
            const unique = randomUUID();

            await createCategory(`First ${unique}`, `first-${unique}`);
            const second = await createCategory(`Second ${unique}`, `second-${unique}`);

            const response = await request(app)
                .patch(`/api/v1/categories/${second.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: `First ${unique}` });

            expect(response.status).toBe(409);
        });
    });

    describe("DELETE /api/v1/categories/:categoryId", () => {
        it("should allow an admin to delete a category", async () => {
            const category = await createCategory(
                "Temporary",
                `temporary-${randomUUID()}`,
            );

            const response = await request(app)
                .delete(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            expect(
                await prisma.category.findUnique({
                    where: { id: category.id },
                }),
            ).toBeNull();

            createdCategoryIds.splice(
                createdCategoryIds.indexOf(category.id),
                1,
            );
        });

        it("should preserve shows when deleting a category", async () => {
            const category = await createCategory(
                "Temporary",
                `temporary-${randomUUID()}`,
            );

            const show = await createShow("Preserved Show");

            await prisma.showCategory.create({
                data: {
                    showId: show.id,
                    categoryId: category.id,
                },
            });

            const response = await request(app)
                .delete(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(200);

            expect(
                await prisma.show.findUnique({
                    where: { id: show.id },
                }),
            ).not.toBeNull();

            expect(
                await prisma.showCategory.findMany({
                    where: { showId: show.id },
                }),
            ).toHaveLength(0);

            createdCategoryIds.splice(
                createdCategoryIds.indexOf(category.id),
                1,
            );
        });

        it("should reject customer access", async () => {
            const category = await createCategory(
                "Protected",
                `protected-${randomUUID()}`,
            );

            const response = await request(app)
                .delete(`/api/v1/categories/${category.id}`)
                .set("Authorization", `Bearer ${customerToken}`);

            expect(response.status).toBe(403);
        });

        it("should return 404 for a nonexistent category", async () => {
            const response = await request(app)
                .delete(`/api/v1/categories/${randomUUID()}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
        });
    });
});
