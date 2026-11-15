
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";

import type {
    CreateShowDTO,
    ListShowsDTO,
    ListTrendingShowsDTO,
    UpdateShowDTO,
} from "./show.validator.js";

export class ShowRepository {
    async create(data: CreateShowDTO) {
        const { categoryIds, ...showData } = data;

        return prisma.$transaction(async (tx) => {
            const show = await tx.show.create({
                data: {
                    ...showData,
                },
            });

            if (categoryIds && categoryIds.length > 0) {
                await tx.showCategory.createMany({
                    data: categoryIds.map((categoryId) => ({
                        showId: show.id,
                        categoryId,
                    })),
                });
            }

            return tx.show.findUniqueOrThrow({
                where: { id: show.id },
                include: {
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
                },
            });
        });
    }

    async findAll(query: ListShowsDTO) {
        const { page, limit, search, sortBy, categoryId } = query;

        const where: Prisma.ShowWhereInput = {
            ...(search && {
                title: {
                    contains: search,
                    mode: "insensitive",
                },
            }),

            ...(categoryId && {
                categories: {
                    some: {
                        categoryId,
                    },
                },
            }),
        };

        const [shows, total] = await prisma.$transaction([
            prisma.show.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    createdAt: sortBy === "newest" ? "desc" : "asc",
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
                },
            }),

            prisma.show.count({ where }),
        ]);

        return {
            shows,
            total,
        };
    }

    async findById(id: string) {
        return prisma.show.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                description: true,
                coverImageUrl: true,
                createdAt: true,
                updatedAt: true,

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

                episodes: {
                    orderBy: {
                        episodeNumber: "asc",
                    },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        durationInSeconds: true,
                        episodeNumber: true,
                        createdAt: true,
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
    }

    async findExistingCategoryIds(categoryIds: string[]) {
        return prisma.category.findMany({
            where: {
                id: {
                    in: categoryIds,
                },
            },
            select: {
                id: true,
            },
        });
    }

    async update(id: string, data: UpdateShowDTO) {
        const { categoryIds, ...showData } = data;

        return prisma.$transaction(async (tx) => {
            await tx.show.update({
                where: { id },
                data: showData,
            });

            if (categoryIds !== undefined) {
                await tx.showCategory.deleteMany({
                    where: { showId: id },
                });

                if (categoryIds.length > 0) {
                    await tx.showCategory.createMany({
                        data: categoryIds.map((categoryId) => ({
                            showId: id,
                            categoryId,
                        })),
                    });
                }
            }

            return tx.show.findUniqueOrThrow({
                where: { id },
                include: {
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
                },
            });
        });
    }

    async delete(id: string) {
        return prisma.show.delete({
            where: { id },
            select: {
                id: true,
                title: true,
            },
        });
    }

    async existsById(id: string) {
        const show = await prisma.show.findUnique({
            where: { id },
            select: { id: true },
        });

        return show !== null;
    }

    async findTrending(query: ListTrendingShowsDTO) {
    const { page, limit } = query;

    const [shows, total] = await prisma.$transaction([
        prisma.show.findMany({
            skip: (page - 1) * limit,
            take: limit,

            orderBy: [
                {
                    follows: {
                        _count: "desc",
                    },
                },
                {
                    createdAt: "desc",
                },
            ],

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
                        follows: true,
                        episodes: true,
                    },
                },
            },
        }),

        prisma.show.count(),
    ]);

    return {
        shows: shows.map((show) => ({
            ...show,
            followerCount: show._count.follows,
            episodeCount: show._count.episodes,
            _count: undefined,
        })),
        total,
    };
}
}
