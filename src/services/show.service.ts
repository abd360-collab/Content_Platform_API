import { ShowRepository } from "../repositories/show.repository.js";
import { AppError } from "../utils/app-error.js";
import type { CreateShowDTO, ListShowsDTO, UpdateShowDTO } from "../validators/show.validator.js";

export class ShowService {
    constructor(
        private readonly showRepository: ShowRepository,
    ) {}

    async createShow(data: CreateShowDTO) {
        const show = await this.showRepository.create(data);

        return show;
    }


    async getAllShows(query: ListShowsDTO) {
    const { shows, total } = await this.showRepository.findAll(query);

    const totalPages = Math.ceil(total / query.limit);

    return {
        shows,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages,
            hasNextPage: query.page < totalPages,
            hasPreviousPage: query.page > 1,
        },
    };
}

async getShowById(id: string) {
    const show = await this.showRepository.findById(id);

    if (!show) {
        throw new AppError(404, "Show not found");
    }

    return show;
}

async updateShow(id: string, data: UpdateShowDTO) {
    const updatedShow = await this.showRepository.update(id, data);

    return updatedShow;
}

async deleteShow(id: string) {
    const deletedShow = await this.showRepository.delete(id);

    return {
        message: "Show deleted successfully",
        show: deletedShow,
    };
}
}