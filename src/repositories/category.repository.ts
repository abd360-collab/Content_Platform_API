
import { prisma } from "../config/database.js";
import type {
    CreateCategoryDTO,
    ListCategoriesDTO,
    UpdateCategoryDTO,
} from "../validators/category.validator.js";

export class CategoryRepository {
    async create(data: CreateCategoryDTO) {
        return prisma.category.create({
            data: {
                name: data.name,
                slug: data.slug,
                ...(data.description !== undefined && {
                    description: data.description,
                }),
            },
        });
    }

    async findAll(query: ListCategoriesDTO) {
        const { page, limit, search } = query;
        const skip = (page - 1) * limit;

        const where = search
            ? {
                  OR: [
                      {
                          name: {
                              contains: search,
                              mode: "insensitive" as const,
                          },
                      },
                      {
                          slug: {
                              contains: search,
                              mode: "insensitive" as const,
                          },
                      },
                  ],
              }
            : {};

        const [categories, total] = await prisma.$transaction([
            prisma.category.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    name: "asc",
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    createdAt: true,
                    _count: {
                        select: {
                            shows: true,
                        },
                    },
                },
            }),
            prisma.category.count({ where }),
        ]);

        return {
            categories,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findById(id: string) {
        return prisma.category.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                createdAt: true,
                updatedAt: true,
                shows: {
                    select: {
                        show: {
                            select: {
                                id: true,
                                title: true,
                                coverImageUrl: true,
                                createdAt: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        shows: true,
                    },
                },
            },
        });
    }

    async update(id: string, data: UpdateCategoryDTO) {
        return prisma.category.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                updatedAt: true,
            },
        });
    }

    async delete(id: string) {
        return prisma.category.delete({
            where: { id },
            select: {
                id: true,
                name: true,
                slug: true,
            },
        });
    }
}
