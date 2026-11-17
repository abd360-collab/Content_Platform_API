
import "dotenv/config";

import type { StringValue } from "ms";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.string().min(1),

    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace"])
        .default("info"),

    JWT_ACCESS_TOKEN_SECRET: z.string().min(1),
    JWT_REFRESH_TOKEN_SECRET: z.string().min(1),

    JWT_ACCESS_TOKEN_EXPIRY: z
        .string()
        .min(1)
        .transform((value) => value as StringValue),

    JWT_REFRESH_TOKEN_EXPIRY: z
        .string()
        .min(1)
        .transform((value) => value as StringValue),

    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),

    CLOUDINARY_SHOW_COVER_PRESET: z.string().min(1),
    CLOUDINARY_EPISODE_AUDIO_PRESET: z.string().min(1),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        "Invalid environment variables:",
        parsedEnv.error.flatten().fieldErrors,
    );

    process.exit(1);
}

export const env = parsedEnv.data;
