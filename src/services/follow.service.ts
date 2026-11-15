import { FollowRepository } from "../repositories/follow.repository.js";
import { ShowRepository } from "../repositories/show.repository.js";
import { AppError } from "../utils/app-error.js";

export class FollowService {
    constructor(
        private readonly followRepository: FollowRepository,
        private readonly showRepository: ShowRepository,
    ) {}

    async followShow(userId: string, showId: string) {
        const showExists = await this.showRepository.existsById(showId);

        if (!showExists) {
            throw new AppError(404, "Show not found");
        }

        return this.followRepository.followShow(userId, showId);
    }


    async unfollowShow(userId: string, showId: string) {
    const deletedCount = await this.followRepository.unfollowShow(
        userId,
        showId,
    );

    if (deletedCount === 0) {
        throw new AppError(404, "You are not following this show");
    }

    return {
        message: "Show unfollowed successfully",
    };
}


async getFollowedShows(
    userId: string,
    page: number,
    limit: number,
) {
    return this.followRepository.findFollowedShows(
        userId,
        page,
        limit,
    );
}

}