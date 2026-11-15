
import { ShowRepository } from "../repositories/show.repository.js";
import { AppError } from "../utils/app-error.js";

import type {
    CreateShowDTO,
    ListShowsDTO,
    UpdateShowDTO,
} from "../validators/show.validator.js";

export class ShowService {
    constructor(
        private readonly showRepository: ShowRepository,
    ) {}

    private async validateCategories(categoryIds?: string[]) {
        if (!categoryIds || categoryIds.length === 0) {
            return;
        }

        const existingCategories =
            await this.showRepository.findExistingCategoryIds(categoryIds);

        if (existingCategories.length !== categoryIds.length) {
            throw new AppError(
                404,
                "One or more categories were not found",
            );
        }
    }

    async createShow(data: CreateShowDTO) {
        await this.validateCategories(data.categoryIds);

        return this.showRepository.create(data);
    }

    async getAllShows(query: ListShowsDTO) {
        if (query.categoryId) {
            const categoryExists =
                await this.showRepository.findExistingCategoryIds([
                    query.categoryId,
                ]);

            if (categoryExists.length === 0) {
                throw new AppError(404, "Category not found");
            }
        }

        const result = await this.showRepository.findAll(query);

        return {
            ...result,
            pagination: {
                page: query.page,
                limit: query.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / query.limit),
            },
        };
    }

    async getShowById(showId: string) {
        const show = await this.showRepository.findById(showId);

        if (!show) {
            throw new AppError(404, "Show not found");
        }

        return show;
    }

    async updateShow(showId: string, data: UpdateShowDTO) {
        const show = await this.showRepository.findById(showId);

        if (!show) {
            throw new AppError(404, "Show not found");
        }

        await this.validateCategories(data.categoryIds);

        return this.showRepository.update(showId, data);
    }

    async deleteShow(showId: string) {
        const show = await this.showRepository.findById(showId);

        if (!show) {
            throw new AppError(404, "Show not found");
        }

        return this.showRepository.delete(showId);
    }
}
