
import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { comparePassword } from "../../src/utils/password.js";



describe("POST /api/v1/auth/logout-all", () => {
    it("should revoke all sessions belonging to the authenticated user", async () => {
        const email = `logout-all-${randomUUID()}@example.com`;
        const password = "StrongPassword123!";

        await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Logout All User",
                email,
                password,
            });

        // Simulate login from device 1.
        const firstLogin = await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password });

        // Simulate login from device 2.
        const secondLogin = await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password });

        const accessToken = firstLogin.body.data.accessToken;
        const firstRefreshToken = firstLogin.body.data.refreshToken;
        const secondRefreshToken = secondLogin.body.data.refreshToken;

        const logoutResponse = await request(app)
            .post("/api/v1/auth/logout-all")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(logoutResponse.status).toBe(200);
        expect(logoutResponse.body.success).toBe(true);

        // Both device sessions should now be invalid.
        const firstRefreshResponse = await request(app)
            .post("/api/v1/auth/refresh")
            .send({ refreshToken: firstRefreshToken });

        const secondRefreshResponse = await request(app)
            .post("/api/v1/auth/refresh")
            .send({ refreshToken: secondRefreshToken });

        expect(firstRefreshResponse.status).toBe(401);
        expect(secondRefreshResponse.status).toBe(401);
    });

    it("should reject unauthenticated logout-all requests", async () => {
        const response = await request(app)
            .post("/api/v1/auth/logout-all");

        expect(response.status).toBe(401);
    });
});





describe("Refresh token and logout", () => {
    async function createAuthenticatedUser() {
        const email = `session-${randomUUID()}@example.com`;
        const password = "StrongPassword123!";

        await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Session Test User",
                email,
                password,
            });

        const loginResponse = await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password });

        return {
            accessToken: loginResponse.body.data.accessToken,
            refreshToken: loginResponse.body.data.refreshToken,
        };
    }

    it("should issue new tokens using a valid refresh token", async () => {
        const { refreshToken } = await createAuthenticatedUser();

        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({ refreshToken });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();

        // Token rotation: the new refresh token must differ.
        expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it("should reject an invalid refresh token", async () => {
        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({ refreshToken: "invalid-refresh-token" });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });

    it("should reject refresh after logout", async () => {
        const { refreshToken } = await createAuthenticatedUser();

        const logoutResponse = await request(app)
            .post("/api/v1/auth/logout")
            .send({ refreshToken });

        expect(logoutResponse.status).toBe(200);

        const refreshResponse = await request(app)
            .post("/api/v1/auth/refresh")
            .send({ refreshToken });

        expect(refreshResponse.status).toBe(401);
    });
});



    it("should login successfully with correct credentials", async () => {
        const email = `login-${randomUUID()}@example.com`;
        const password = "StrongPassword123!";

        // Register a user first.
        await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Login Test User",
                email,
                password,
            });

        // Attempt login.
        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email,
                password,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();

        expect(response.body.data.user).toMatchObject({
            email,
            name: "Login Test User",
        });

        expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it("should reject login with incorrect password", async () => {
        const email = `wrong-password-${randomUUID()}@example.com`;

        await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Wrong Password User",
                email,
                password: "StrongPassword123!",
            });

        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email,
                password: "WrongPassword123!",
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
            "Invalid email or password",
        );
    });

    it("should reject login with nonexistent email", async () => {
        const response = await request(app)
            .post("/api/v1/auth/login")
            .send({
                email: `missing-${randomUUID()}@example.com`,
                password: "StrongPassword123!",
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
            "Invalid email or password",
        );
    });

    describe("POST /api/v1/auth/register", () => {
    it("should register a user successfully", async () => {
        const email = `test-${randomUUID()}@example.com`;
        const password = "StrongPassword123!";

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "Test User",
                email,
                password,
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        expect(response.body.data).toMatchObject({
            email,
            name: "Test User",
        });

        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.createdAt).toBeDefined();

        // Sensitive information must not be returned.
        expect(response.body.data.passwordHash).toBeUndefined();
        expect(response.body.data.password).toBeUndefined();

        // Verify the record actually exists in PostgreSQL.
        const user = await prisma.user.findUnique({
            where: { email },
        });

        expect(user).not.toBeNull();

        // Verify that the password is not stored as plaintext.
        expect(user!.passwordHash).not.toBe(password);

        // Verify that the stored hash corresponds to the password.
        expect(
            await comparePassword(password, user!.passwordHash),
        ).toBe(true);
    });

    it("should reject duplicate email registration", async () => {
        const email = `duplicate-${randomUUID()}@example.com`;

        const userData = {
            name: "Duplicate User",
            email,
            password: "StrongPassword123!",
        };

        const firstResponse = await request(app)
            .post("/api/v1/auth/register")
            .send(userData);

        expect(firstResponse.status).toBe(201);

        const secondResponse = await request(app)
            .post("/api/v1/auth/register")
            .send(userData);

        expect(secondResponse.status).toBe(409);
        expect(secondResponse.body.success).toBe(false);
        expect(secondResponse.body.message).toBe(
            "Email already registered",
        );
    });

    it("should reject invalid registration input", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({
                name: "A",
                email: "invalid-email",
                password: "123",
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
        expect(response.body.errors).toBeDefined();
    });
});