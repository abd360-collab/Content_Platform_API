
import { CategoryRepository } from "./category.repository.js";
import { AppError } from "../../common/errors/app-error.js";
import type {
    CreateCategoryDTO,
    ListCategoriesDTO,
    UpdateCategoryDTO,
} from "./category.validator.js";

export class CategoryService {
    constructor(
        private readonly categoryRepository: CategoryRepository,
    ) {}

    async createCategory(data: CreateCategoryDTO) {
        return this.categoryRepository.create(data);
    }

    async getAllCategories(query: ListCategoriesDTO) {
        return this.categoryRepository.findAll(query);
    }

    async getCategoryById(categoryId: string) {
        const category = await this.categoryRepository.findById(categoryId);

        if (!category) {
            throw new AppError(404, "Category not found");
        }

        return category;
    }

    async updateCategory(
        categoryId: string,
        data: UpdateCategoryDTO,
    ) {
        const category = await this.categoryRepository.findById(categoryId);

        if (!category) {
            throw new AppError(404, "Category not found");
        }

        return this.categoryRepository.update(categoryId, data);
    }

    async deleteCategory(categoryId: string) {
        const category = await this.categoryRepository.findById(categoryId);

        if (!category) {
            throw new AppError(404, "Category not found");
        }

        return this.categoryRepository.delete(categoryId);
    }
}
