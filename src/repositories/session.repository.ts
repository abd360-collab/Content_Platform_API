import { prisma } from "../config/database";
import { AppError } from "../utils/app-error";

export class SessionRepository {
    async create(data: {
        id: string;
        userId: string;
        familyId: string;
        refreshTokenHash: string;
        expiresAt: Date;
    }) {
        return prisma.session.create({
            data,
        });
    }

    async findById(id: string) {
        return prisma.session.findUnique({
            where: {
                id,
            },
        });
    }

    async revoke(id: string) {
        return prisma.session.update({
            where: {
                id,
            },
            data: {
                revokedAt: new Date(),
            }
        })
    }

    async revokeWithReason(
        id: string,
        reason: string,
    ) {
        return prisma.session.update({
            where: {
                id,
            },
            data: {
                revokedAt: new Date(),
                revokedReason: reason,
            },
        });
    }

    async revokeFamily(
        familyId: string,
        reason: string,
    ) {
        return prisma.session.updateMany({
            where: {
                familyId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
                revokedReason: reason,
            }
        })
    }


    async rotate(data: {
        oldSessionId: string;
        newSession: {
            id: string;
            userId: string;
            familyId: string;
            refreshTokenHash: string;
            expiresAt: Date;
        };
    }) {

        return prisma.$transaction(async (tx) => {
            const result = await tx.session.updateMany({
                where: {
                    id: data.oldSessionId,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                    revokedReason: "ROTATED",
                },
            });

            if(result.count !== 1) {
               throw new AppError(
                409,
                "Refresh token was already used",
               );
            }

            return tx.session.create({
                data: data.newSession,
            });
        });
    }
}