
import { randomUUID } from "node:crypto";
import request from "supertest";

import app from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { hashPassword } from "../../src/modules/auth/password.js";

export async function createAdminToken() {
    const email = `admin-${randomUUID()}@example.com`;
    const password = "StrongPassword123!";

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
        data: {
            name: "Media Test Admin",
            email,
            passwordHash,
            role: "ADMIN",
        },
    });

    const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password });

    if (loginResponse.status !== 200) {
        await prisma.user.delete({
            where: { id: user.id },
        });

        throw new Error("Failed to authenticate test admin");
    }

    return {
        userId: user.id,
        accessToken: loginResponse.body.data.accessToken as string,
    };
}
