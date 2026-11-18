
import { z } from "zod";

export const generateUploadSignatureSchema = z.object({
    mediaType: z.enum(["SHOW_COVER", "EPISODE_AUDIO"]),
});

export type GenerateUploadSignatureDTO = z.infer<
    typeof generateUploadSignatureSchema
>;

export const verifyUploadSchema = z.object({
    uploadId: z.string().uuid(),
});

export type VerifyUploadDTO = z.infer<
    typeof verifyUploadSchema
>;
