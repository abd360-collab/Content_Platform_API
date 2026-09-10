import { z } from "zod";

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2).max(100),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});
export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

export type RegisterDTO = z.infer<typeof registerSchema>;
export type LoginDTO = z.infer<typeof loginSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;