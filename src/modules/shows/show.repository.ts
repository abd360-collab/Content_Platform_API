
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";

import type {
    CreateShowDTO,
    ListShowsDTO,
    ListTrendingShowsDTO,
    UpdateShowDTO,
} from "./show.validator.js";

export class ShowRepository {
    private async attachCoverImage(
        tx: Prisma.TransactionClient,
        adminId: string,
        uploadId: string,
    ): Promise<string> {
        const result = await tx.mediaUpload.updateMany({
            where: {
                id: uploadId,
                userId: adminId,
                mediaType: "SHOW_COVER",
                status: "VERIFIED",
            },
            data: {
                status: "ATTACHED",
                attachedAt: new Date(),
            },
        });

        if (result.count !== 1) {
            throw new AppError(
                409,
                "Cover image upload is invalid, unavailable, or already attached",
            );
        }

        const upload = await tx.mediaUpload.findUnique({
            where: {
                id: uploadId,
            },
            select: {
                secureUrl: true,
            },
        });

        if (!upload?.secureUrl) {
            throw new AppError(
                409,
                "Verified cover image URL is unavailable",
            );
        }

        return upload.secureUrl;
    }

    async create(adminId: string, data: CreateShowDTO) {
        const {
            categoryIds,
            coverUploadId,
            ...showData
        } = data;

        return prisma.$transaction(async (tx) => {
            let coverImageUrl: string | undefined;

            if (coverUploadId) {
                coverImageUrl = await this.attachCoverImage(
                    tx,
                    adminId,
                    coverUploadId,
                );
            }

            const show = await tx.show.create({
                data: {
                    ...showData,
                    ...(coverImageUrl && { coverImageUrl }),
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
                OR: [
                    {
                        title: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                    {
                        description: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                ],
            }),

            ...(categoryId && {
                categories: {
                    some: {
                        categoryId,
                    },
                },
            }),
        };

        const orderBy: Prisma.ShowOrderByWithRelationInput[] =
            sortBy === "popular"
                ? [
                    {
                        follows: {
                            _count: "desc",
                        },
                    },
                    {
                        createdAt: "desc",
                    },
                ]
                : [
                    {
                        createdAt: sortBy === "newest" ? "desc" : "asc",
                    },
                ];

        const [shows, total] = await prisma.$transaction([
            prisma.show.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy,

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

                    ...(sortBy === "popular" && {
                        _count: {
                            select: {
                                follows: true,
                            },
                        },
                    }),
                },
            }),

            prisma.show.count({ where }),
        ]);

        return {
            shows: shows.map((show) => ({
                ...show,
                ...(sortBy === "popular" && {
                    followerCount: show._count.follows,
                    _count: undefined,
                }),
            })),
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

    async update(
        adminId: string,
        id: string,
        data: UpdateShowDTO,
    ) {
        const {
            categoryIds,
            coverUploadId,
            ...showData
        } = data;

        return prisma.$transaction(async (tx) => {
            let coverImageUrl: string | undefined;

            if (coverUploadId) {
                coverImageUrl = await this.attachCoverImage(
                    tx,
                    adminId,
                    coverUploadId,
                );
            }

            await tx.show.update({
                where: { id },
                data: {
                    ...showData,
                    ...(coverImageUrl && { coverImageUrl }),
                },
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
