import { prisma } from "../config/database.js";

export class FollowRepository {
    async followShow(userId: string, showId: string) {
        return prisma.follow.create({
            data: {
                userId,
                showId,
            },
            select: {
                userId: true,
                showId: true,
                createdAt: true,
            },
        });
    }

    async unfollowShow(userId: string, showId: string) {
    const result = await prisma.follow.deleteMany({
        where: {
            userId,
            showId,
        },
    });

    return result.count;
}

 async findFollowedShows(
    userId: string,
    page: number,
    limit: number,
) {
    const skip = (page - 1) * limit;

    const [follows, total] = await prisma.$transaction([
        prisma.follow.findMany({
            where: { userId },
            skip,
            take: limit,
            orderBy: {
                createdAt: "desc",
            },
            select: {
                createdAt: true,
                show: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        coverImageUrl: true,
                        createdAt: true,
                        _count: {
                            select: {
                                episodes: true,
                                follows: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.follow.count({
            where: { userId },
        }),
    ]);

    return {
        shows: follows.map((follow) => ({
            ...follow.show,
            followedAt: follow.createdAt,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
}