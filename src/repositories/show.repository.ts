import { prisma } from "../config/database.js";
import { ListShowsDTO, UpdateShowDTO } from "../validators/show.validator.js";

export class ShowRepository {
    async create(data: {
        title: string;
        description: string;
        coverImageUrl?: string;
    }) {
        return prisma.show.create({
            data: {
                title: data.title,
                description: data.description,
                ...(data.coverImageUrl !== undefined && {
                    coverImageUrl: data.coverImageUrl,
                }),
            },
        });
    }

    async findAll(query: ListShowsDTO) {
    const { page, limit, search, sortBy } = query;

    const where = search
        ? {
              title: {
                  contains: search,
                  mode: "insensitive" as const,
              },
          }
        : {};

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
            },
        }),

        prisma.show.count({ where }),
    ]);

    return { shows, total };
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

async update(id: string, data: UpdateShowDTO) {
    return prisma.show.update({
        where: { id },
        data,
        select: {
            id: true,
            title: true,
            description: true,
            coverImageUrl: true,
            createdAt: true,
            updatedAt: true,
        },
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
}