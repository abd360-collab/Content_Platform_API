import { prisma } from "../../config/database.js";


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


    async findById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
        },
    });
}


      async updateProfile(
    id: string,
    data: { name: string },
) {
    return prisma.user.update({
        where: { id },
        data: {
            name: data.name,
        },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
        },
    });
}


     async findPasswordHashById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            passwordHash: true,
        },
    });
}

async updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
        where: { id },
        data: { passwordHash },
        select: {
            id: true,
            updatedAt: true,
        },
    });
}




async deleteById(id: string) {
    return prisma.user.delete({
        where: { id },
        select: {
            id: true,
        },
    });
}

async getAccountStats(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            createdAt: true,
            _count: {
                select: {
                    follows: true,
                    listeningProgress: true,
                },
            },
        },
    });
}


}