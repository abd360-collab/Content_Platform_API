import { z } from "zod";

export const updateProfileSchema = z.object({
    name: z.string().trim().min(2).max(100),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8).max(128),
}).refine(
    (data) => data.currentPassword !== data.newPassword,
    {
        message: "New password must be different from current password",
        path: ["newPassword"],
    },
);

export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;

export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>;