
import { randomUUID } from "node:crypto";

import { cloudinary } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../common/errors/app-error.js";

export type MediaType = "SHOW_COVER" | "EPISODE_AUDIO";

interface UploadSignature {
    uploadId: string;
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    uploadPreset: string;
    publicId: string;
    resourceType: "image" | "video";
    allowedFormats: string[];
    maxFileSize: number;
    overwrite: false;
}

interface VerifiedUpload {
    uploadId: string;
    publicId: string;
    secureUrl: string;
    format: string;
    bytes: number;
    mediaType: MediaType;
    status: "VERIFIED";
}

export class MediaService {
    async generateUploadSignature(
        userId: string,
        mediaType: MediaType,
    ): Promise<UploadSignature> {
        const timestamp = Math.floor(Date.now() / 1000);

        const isShowCover = mediaType === "SHOW_COVER";

        const uploadPreset = isShowCover
            ? env.CLOUDINARY_SHOW_COVER_PRESET
            : env.CLOUDINARY_EPISODE_AUDIO_PRESET;

        const resourceType = isShowCover ? "image" : "video";

        const allowedFormats = isShowCover
            ? ["jpg", "jpeg", "png", "webp"]
            : ["mp3", "m4a", "aac", "wav", "ogg"];

        const maxFileSize = isShowCover
            ? 5 * 1024 * 1024
            : 50 * 1024 * 1024;

        const publicId = `${mediaType.toLowerCase()}-${randomUUID()}`;

        const paramsToSign = {
            timestamp,
            upload_preset: uploadPreset,
            public_id: publicId,
            overwrite: false,
        };

        const signature = cloudinary.utils.api_sign_request(
            paramsToSign,
            env.CLOUDINARY_API_SECRET,
        );

        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const mediaUpload = await prisma.mediaUpload.create({
            data: {
                userId,
                mediaType,
                publicId,
                resourceType,
                expiresAt,
            },
        });

        return {
            uploadId: mediaUpload.id,
            signature,
            timestamp,
            apiKey: env.CLOUDINARY_API_KEY,
            cloudName: env.CLOUDINARY_CLOUD_NAME,
            uploadPreset,
            publicId,
            resourceType,
            allowedFormats,
            maxFileSize,
            overwrite: false,
        };
    }

    async verifyUpload(
        userId: string,
        uploadId: string,
    ): Promise<VerifiedUpload> {
        const claim = await prisma.mediaUpload.updateMany({
            where: {
                id: uploadId,
                userId,
                status: "PENDING",
                expiresAt: {
                    gt: new Date(),
                },
            },
            data: {
                status: "VERIFYING",
            },
        });

        if (claim.count !== 1) {
            const mediaUpload = await prisma.mediaUpload.findFirst({
                where: {
                    id: uploadId,
                    userId,
                },
            });

            if (!mediaUpload) {
                throw new AppError(404, "Media upload not found");
            }

            if (mediaUpload.status === "VERIFIED") {
                return {
                    uploadId: mediaUpload.id,
                    publicId: mediaUpload.publicId,
                    secureUrl: mediaUpload.secureUrl!,
                    format: mediaUpload.format!,
                    bytes: mediaUpload.bytes!,
                    mediaType: mediaUpload.mediaType,
                    status: "VERIFIED",
                };
            }

            if (
                mediaUpload.status === "PENDING" &&
                mediaUpload.expiresAt <= new Date()
            ) {
                await prisma.mediaUpload.updateMany({
                    where: {
                        id: mediaUpload.id,
                        status: "PENDING",
                    },
                    data: {
                        status: "EXPIRED",
                    },
                });

                throw new AppError(
                    410,
                    "Media upload authorization has expired",
                );
            }

            switch (mediaUpload.status) {
                case "VERIFYING":
                    throw new AppError(
                        409,
                        "Media upload verification is already in progress. Please retry shortly.",
                    );

                case "REJECTED":
                    throw new AppError(
                        422,
                        "This media upload was rejected and cannot be verified again",
                    );

                case "EXPIRED":
                    throw new AppError(
                        410,
                        "Media upload authorization has expired",
                    );

                case "ATTACHED":
                    throw new AppError(
                        409,
                        "This media upload has already been attached to content",
                    );

                default:
                    throw new AppError(
                        409,
                        "Media upload cannot be verified in its current state",
                    );
            }
        }

        const mediaUpload = await prisma.mediaUpload.findUniqueOrThrow({
            where: {
                id: uploadId,
            },
        });

        let resource;

        try {
            resource = await cloudinary.api.resource(
                mediaUpload.publicId,
                {
                    resource_type: mediaUpload.resourceType,
                    type: "upload",
                },
            );
        } catch (error) {
            const cloudinaryError = error as {
                http_code?: number;
            };

            await prisma.mediaUpload.updateMany({
                where: {
                    id: mediaUpload.id,
                    status: "VERIFYING",
                },
                data: {
                    status: "PENDING",
                },
            });

            if (cloudinaryError.http_code === 404) {
                throw new AppError(
                    404,
                    "Uploaded asset was not found in Cloudinary",
                );
            }

            throw new AppError(
                502,
                "Unable to verify media asset with Cloudinary",
            );
        }

        const isShowCover = mediaUpload.mediaType === "SHOW_COVER";

        const allowedFormats = isShowCover
            ? ["jpg", "jpeg", "png", "webp"]
            : ["mp3", "m4a", "aac", "wav", "ogg"];

        const maxFileSize = isShowCover
            ? 5 * 1024 * 1024
            : 50 * 1024 * 1024;

        const expectedResourceType = isShowCover ? "image" : "video";

        const isValidIdentity =
            resource.public_id === mediaUpload.publicId &&
            resource.resource_type === expectedResourceType;

        const isValidFormat =
            typeof resource.format === "string" &&
            allowedFormats.includes(resource.format.toLowerCase());

        const isValidSize =
            Number.isSafeInteger(resource.bytes) &&
            resource.bytes > 0 &&
            resource.bytes <= maxFileSize;

        const isValidUrl =
            typeof resource.secure_url === "string" &&
            resource.secure_url.startsWith("https://");

        if (
            !isValidIdentity ||
            !isValidFormat ||
            !isValidSize ||
            !isValidUrl
        ) {
            await prisma.mediaUpload.update({
                where: {
                    id: mediaUpload.id,
                },
                data: {
                    status: "REJECTED",
                },
            });

            try {
                await cloudinary.uploader.destroy(
                    mediaUpload.publicId,
                    {
                        resource_type: mediaUpload.resourceType,
                        type: "upload",
                    },
                );
            } catch {
                // Cleanup can be retried separately.
            }

            throw new AppError(
                422,
                "Uploaded asset failed media validation",
            );
        }

        const verifiedUpload = await prisma.mediaUpload.update({
            where: {
                id: mediaUpload.id,
            },
            data: {
                status: "VERIFIED",
                secureUrl: resource.secure_url,
                format: resource.format,
                bytes: resource.bytes,
                verifiedAt: new Date(),
            },
        });

        return {
            uploadId: verifiedUpload.id,
            publicId: verifiedUpload.publicId,
            secureUrl: verifiedUpload.secureUrl!,
            format: verifiedUpload.format!,
            bytes: verifiedUpload.bytes!,
            mediaType: verifiedUpload.mediaType,
            status: "VERIFIED",
        };
    }
}
