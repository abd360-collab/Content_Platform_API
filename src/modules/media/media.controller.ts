
import type { Request, Response, NextFunction } from "express";

import { MediaService } from "./media.service.js";
import type {
    GenerateUploadSignatureDTO,
    VerifyUploadDTO,
} from "./media.validator.js";

const mediaService = new MediaService();

export async function generateUploadSignature(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { mediaType } = res.locals["body"] as GenerateUploadSignatureDTO;

        const uploadSignature =
            await mediaService.generateUploadSignature(
                req.user!.id,
                mediaType,
            );

        return res.status(200).json({
            success: true,
            data: uploadSignature,
        });
    } catch (error) {
        return next(error);
    }
}

export async function verifyUpload(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { uploadId } = res.locals["body"] as VerifyUploadDTO;

        const verifiedUpload = await mediaService.verifyUpload(
            req.user!.id,
            uploadId,
        );

        return res.status(200).json({
            success: true,
            data: verifiedUpload,
        });
    } catch (error) {
        return next(error);
    }
}
