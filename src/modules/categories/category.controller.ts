
import type { Request, Response, NextFunction } from "express";
import { CategoryRepository } from "./category.repository.js";
import { CategoryService } from "./category.service.js";
import type {
    CategoryIdDTO,
    CreateCategoryDTO,
    ListCategoriesDTO,
    UpdateCategoryDTO,
} from "./category.validator.js";

const categoryRepository = new CategoryRepository();
const categoryService = new CategoryService(categoryRepository);

export async function createCategory(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const data = res.locals["body"] as CreateCategoryDTO;

        const category = await categoryService.createCategory(data);

        res.status(201).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
}

export async function getAllCategories(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const query = res.locals["query"] as ListCategoriesDTO;

        const result = await categoryService.getAllCategories(query);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function getCategoryById(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { categoryId } = res.locals["params"] as CategoryIdDTO;

        const category = await categoryService.getCategoryById(categoryId);

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateCategory(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { categoryId } = res.locals["params"] as CategoryIdDTO;
        const data = res.locals["body"] as UpdateCategoryDTO;

        const category = await categoryService.updateCategory(categoryId, data);

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteCategory(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { categoryId } = res.locals["params"] as CategoryIdDTO;

        const category = await categoryService.deleteCategory(categoryId);

        res.status(200).json({
            success: true,
            data: category,
            message: "Category deleted successfully",
        });
    } catch (error) {
        next(error);
    }
}
