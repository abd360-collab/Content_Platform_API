import { prisma } from "../config/database.js";
import { ListUsersDTO } from "../validators/admin.validator.js";

export class AdminRepository {
    async getDashboardStats() {
        const [
            totalUsers,
            totalShows,
            totalEpisodes,
            totalFollows,
            totalListeningProgress,
        ] = await prisma.$transaction([
            prisma.user.count(),
            prisma.show.count(),
            prisma.episode.count(),
            prisma.follow.count(),
            prisma.listeningProgress.count(),
        ]);

        return {
            totalUsers,
            totalShows,
            totalEpisodes,
            totalFollows,
            totalListeningProgress,
        };
    }

    async getUsers(query: ListUsersDTO) {
    const { page, limit, search, role, sortBy } = query;

    const skip = (page - 1) * limit;

    const where = {
        ...(role && { role }),

        ...(search && {
            OR: [
                {
                    name: {
                        contains: search,
                        mode: "insensitive" as const,
                    },
                },
                {
                    email: {
                        contains: search,
                        mode: "insensitive" as const,
                    },
                },
            ],
        }),
    };

    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({
            where,
            skip,
            take: limit,

            orderBy: {
                createdAt: sortBy === "newest" ? "desc" : "asc",
            },

            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        }),

        prisma.user.count({ where }),
    ]);

    return {
        users,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
}