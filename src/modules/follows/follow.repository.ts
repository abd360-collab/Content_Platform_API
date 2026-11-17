
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";

interface RecommendationCategory {
    category: {
        id: string;
        name: string;
        slug: string;
    };
}

interface RecommendationRow {
    id: string;
    title: string;
    description: string;
    coverImageUrl: string | null;
    createdAt: Date;
    categories: RecommendationCategory[];
    matchingCategoryCount: number;
    followerCount: number;
    episodeCount: number;
}

export class FollowRepository {
    async followShow(userId: string, showId: string) {
        return prisma.follow.upsert({
            where: {
                userId_showId: {
                    userId,
                    showId,
                },
            },
            create: {
                userId,
                showId,
            },
            update: {},
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

        const [totalRows, shows] = await prisma.$transaction(
            async (tx) => {
                const totalResult = await tx.$queryRaw<
                    { total: number }[]
                >`
                    SELECT COUNT(*)::int AS total
                    FROM "Show" s
                    WHERE
                        NOT EXISTS (
                            SELECT 1
                            FROM "Follow" f
                            WHERE
                                f."userId" = ${userId}
                                AND f."showId" = s.id
                        )
                        AND EXISTS (
                            SELECT 1
                            FROM "ShowCategory" sc
                            WHERE
                                sc."showId" = s.id
                                AND sc."categoryId" IN (
                                    ${Prisma.join(categoryIds)}
                                )
                        )
                `;

                const recommendationRows = await tx.$queryRaw<
                    RecommendationRow[]
                >`
                    SELECT
                        s.id,
                        s.title,
                        s.description,
                        s."coverImageUrl",
                        s."createdAt",

                        COUNT(DISTINCT sc."categoryId")::int
                            AS "matchingCategoryCount",

                        (
                            SELECT COUNT(*)::int
                            FROM "Follow" f
                            WHERE f."showId" = s.id
                        ) AS "followerCount",

                        (
                            SELECT COUNT(*)::int
                            FROM "Episode" e
                            WHERE e."showId" = s.id
                        ) AS "episodeCount",

                        COALESCE(
                            jsonb_agg(
                                jsonb_build_object(
                                    'category',
                                    jsonb_build_object(
                                        'id', c.id,
                                        'name', c.name,
                                        'slug', c.slug
                                    )
                                )
                                ORDER BY c.name
                            ),
                            '[]'::jsonb
                        ) AS categories

                    FROM "Show" s

                    INNER JOIN "ShowCategory" sc
                        ON sc."showId" = s.id

                    INNER JOIN "Category" c
                        ON c.id = sc."categoryId"

                    WHERE
                        sc."categoryId" IN (
                            ${Prisma.join(categoryIds)}
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM "Follow" f
                            WHERE
                                f."userId" = ${userId}
                                AND f."showId" = s.id
                        )

                    GROUP BY s.id

                    ORDER BY
                        "matchingCategoryCount" DESC,
                        "followerCount" DESC,
                        s."createdAt" DESC

                    LIMIT ${limit}
                    OFFSET ${skip}
                `;

                return [totalResult, recommendationRows] as const;
            },
        );

        const total = totalRows[0]?.total ?? 0;

        return {
            shows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
