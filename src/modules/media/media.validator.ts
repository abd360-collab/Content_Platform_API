
import { z } from "zod";

export const generateUploadSignatureSchema = z.object({
    body: z.object({
        mediaType: z.enum(["SHOW_COVER", "EPISODE_AUDIO"]),
    }),
});

export type GenerateUploadSignatureDTO = z.infer<
    typeof generateUploadSignatureSchema
>["body"];

export const verifyUploadSchema = z.object({
    body: z.object({
        uploadId: z.string().uuid(),
    }),
});

export type VerifyUploadDTO = z.infer<
    typeof verifyUploadSchema
>["body"];
