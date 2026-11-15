import { prisma } from "../../config/database.js";

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



async findRecommendations(
    userId: string,
    page: number,
    limit: number,
) {
    const skip = (page - 1) * limit;

    const followedCategories = await prisma.showCategory.findMany({
        where: {
            show: {
                follows: {
                    some: { userId },
                },
            },
        },
        select: {
            categoryId: true,
        },
        distinct: ["categoryId"],
    });

    const categoryIds = followedCategories.map(
        (category) => category.categoryId,
    );

    if (categoryIds.length === 0) {
        return {
            shows: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
            },
        };
    }

    const followedShows = await prisma.follow.findMany({
        where: { userId },
        select: { showId: true },
    });

    const excludedShowIds = followedShows.map(
        (follow) => follow.showId,
    );

    const candidates = await prisma.show.findMany({
        where: {
            id: {
                notIn: excludedShowIds,
            },
            categories: {
                some: {
                    categoryId: {
                        in: categoryIds,
                    },
                },
            },
        },
        select: {
            id: true,
            title: true,
            description: true,
            coverImageUrl: true,
            createdAt: true,
            categories: {
                select: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    episodes: true,
                    follows: true,
                },
            },
        },
    });

    const matchingShows = candidates.map((show) => {
        const matchingCategoryCount = show.categories.filter(
            (item) => categoryIds.includes(item.category.id),
        ).length;

        return {
            ...show,
            matchingCategoryCount,
            followerCount: show._count.follows,
            episodeCount: show._count.episodes,
            _count: undefined,
        };
    });

    matchingShows.sort(
        (a, b) =>
            b.matchingCategoryCount - a.matchingCategoryCount ||
            b.followerCount - a.followerCount ||
            b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const total = matchingShows.length;

    return {
        shows: matchingShows.slice(skip, skip + limit),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
}