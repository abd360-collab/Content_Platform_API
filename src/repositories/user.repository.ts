import { prisma } from "../config/database.js";


export class UserRepository {
    async findbyEmail(email: string) {
        return prisma.user.findUnique({
            where: {
                email,
            },
        });
    }

    async createUser(data: {
        email: string,
        passwordHash: string,
        name: string
    }) {
        return prisma.user.create({
            data,
        });
    }
}