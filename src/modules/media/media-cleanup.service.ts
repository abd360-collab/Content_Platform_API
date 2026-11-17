
import { prisma } from "../../config/database.js";
import { cloudinary } from "../../config/cloudinary.js";
import { logger } from "../../config/logger.js";

export class MediaCleanupService {
    async recoverStaleVerifications(): Promise<void> {
        const now = new Date();

        // A verification request stuck for more than 10 minutes
        // is considered interrupted.
        const staleBefore = new Date(
            now.getTime() - 10 * 60 * 1000,
        );

        const staleUploads = await prisma.mediaUpload.findMany({
            where: {
                status: "VERIFYING",
                updatedAt: {
                    lt: staleBefore,
                },
            },
            select: {
                id: true,
                expiresAt: true,
            },
        });

        for (const upload of staleUploads) {
            await prisma.mediaUpload.updateMany({
                where: {
                    id: upload.id,
                    status: "VERIFYING",
                    updatedAt: {
                        lt: staleBefore,
                    },
                },
                data: {
                    status:
                        upload.expiresAt <= now
                            ? "EXPIRED"
                            : "PENDING",
                },
            });
        }

        logger.info(
            { recoveredCount: staleUploads.length },
            "Stale media verifications recovered",
        );
    }

    async expirePendingUploads(): Promise<void> {
        const result = await prisma.mediaUpload.updateMany({
            where: {
                status: "PENDING",
                expiresAt: {
                    lte: new Date(),
                },
            },
            data: {
                status: "EXPIRED",
            },
        });

        logger.info(
            { expiredCount: result.count },
            "Expired pending media uploads processed",
        );
    }

    async cleanupRejectedUploads(): Promise<void> {
        // Keep rejected records for 24 hours before attempting
        // Cloudinary cleanup. This gives us an audit trail.
        const retentionDate = new Date(
            Date.now() - 24 * 60 * 60 * 1000,
        );

        const rejectedUploads = await prisma.mediaUpload.findMany({
            where: {
                status: "REJECTED",
                updatedAt: {
                    lte: retentionDate,
                },
            },
            select: {
                id: true,
                publicId: true,
                resourceType: true,
            },
        });

        for (const upload of rejectedUploads) {
            try {
                await cloudinary.uploader.destroy(
                    upload.publicId,
                    {
                        resource_type: upload.resourceType,
                        type: "upload",
                    },
                );

                logger.info(
                    { uploadId: upload.id },
                    "Rejected Cloudinary asset cleanup attempted",
                );
            } catch (error) {
                logger.error(
                    { err: error, uploadId: upload.id },
                    "Failed to clean up rejected Cloudinary asset",
                );
            }
        }
    }

    async run(): Promise<void> {
        await this.recoverStaleVerifications();
        await this.expirePendingUploads();
        await this.cleanupRejectedUploads();
    }
}
