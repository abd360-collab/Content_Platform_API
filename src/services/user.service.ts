import { UserRepository } from "../repositories/user.repository";
import { AppError } from "../utils/app-error";
import { comparePassword, hashPassword } from "../utils/password";
import { LoginDTO, RegisterDTO } from "../validators/auth.validator";
import { SessionRepository } from "../repositories/session.repository.js";
import { randomUUID } from "node:crypto";
import { generateAccessToken,  verifyRefreshToken, generateRefreshToken } from "../utils/jwt";
import { hashRefreshToken } from "../utils/refresh-token";
import ms from "ms";
import { env } from "../config/env";
import type { RefreshTokenDTO, UpdateProfileDTO } from "../validators/auth.validator.js";
import { ChangePasswordDTO } from "../validators/user.validator";



const REFRESH_ROTATION_GRACE_PERIOD_MS = 5_000;

export class UserService {
    // dependency injection
    constructor(
        private readonly userRepository: UserRepository,
        private readonly sessionRepository: SessionRepository,
    ) {}

    async register(data: RegisterDTO) {
        const existingUser = await this.userRepository.findbyEmail(data.email);

        if(existingUser) {
            throw new AppError(
                409,
                "Email already registered"
            );
        }

        const passwordHash = await hashPassword(data.password);

        const user = await this.userRepository.createUser({
            email: data.email,
            passwordHash,
            name: data.name,
        });

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
        };
    }

    async login(data: LoginDTO) {
        
        const user = await this.userRepository.findbyEmail(data.email);

        if(!user) {
            throw new AppError(401, "Invalid email or password");
        }

        const passwordMatches = await comparePassword(
            data.password,
            user.passwordHash,
        );

        if(!passwordMatches) {
            throw new AppError(401, "Invalid email or password");
        }


        const sessionId = randomUUID();

        const refreshToken = generateRefreshToken({
            sub: user.id,
            jti: sessionId,
        });

        const refreshTokenHash = hashRefreshToken(refreshToken);
        
        const expiresAt = new Date(
            Date.now() + ms(env.JWT_REFRESH_TOKEN_EXPIRY),
        );
        const familyId = randomUUID();

        await this.sessionRepository.create({
            id: sessionId,
            userId: user.id,
            familyId,
            refreshTokenHash,
            expiresAt,
        });

        const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role,
});

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        };

    }

    async refresh(data: RefreshTokenDTO) {

        const payload = verifyRefreshToken(data.refreshToken);

        const session = await this.sessionRepository.findById(
            payload.jti,
        );

        if(!session) {
            throw new AppError(401, "invalid refresh token");
        }

       
if (session.revokedAt) {
    const recentlyRotated =
        session.revokedReason === "ROTATED" &&
        Date.now() - session.revokedAt.getTime() <=
            REFRESH_ROTATION_GRACE_PERIOD_MS;

    if (recentlyRotated) {
        throw new AppError(
            409,
            "Refresh token was recently rotated. Use the latest refresh token.",
        );
    }

    await this.sessionRepository.revokeFamily(
        session.familyId,
        "REUSE_DETECTED",
    );

    throw new AppError(
        401,
        "Refresh token reuse detected",
    );
}


        if(session.expiresAt <= new Date()) {
            throw new AppError(
                401,
                "Refresh session has expired",
            );
        }

        const refreshTokenHash = hashRefreshToken(data.refreshToken);

        if(refreshTokenHash !== session.refreshTokenHash) {
            throw new AppError(
                401,
                "Invalid refresh token",
            );
        }

        const newSessionId = randomUUID();

        const familyId = session.familyId;

        const newRefreshToken = generateRefreshToken({
            sub: session.userId,
            jti: newSessionId,
        });

        const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

        const newExpiresAt = new Date(
            Date.now() + ms(env.JWT_REFRESH_TOKEN_EXPIRY),
        );

        await this.sessionRepository.rotate({
            oldSessionId: session.id,
            newSession: {
                id: newSessionId,
                userId: session.userId,
                familyId: session.familyId,
                refreshTokenHash: newRefreshTokenHash,
                expiresAt: newExpiresAt,
            },
        });

 
        const accessToken = generateAccessToken({
            sub: session.userId,
            role: "CUSTOMER",
        });


        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
    }


    async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
        throw new AppError(404, "User not found");
    }

    return user;
}


       
async logout(data: RefreshTokenDTO) {
    // 1. Verify the refresh token's signature and expiry.
    const payload = verifyRefreshToken(data.refreshToken);

    // 2. Find the session associated with this token.
    const session = await this.sessionRepository.findById(
        payload.jti,
    );

    if (!session || session.userId !== payload.sub) {
        throw new AppError(401, "Invalid refresh token");
    }

    // 3. Verify that this exact token belongs to the session.
    const refreshTokenHash = hashRefreshToken(data.refreshToken);

    if (refreshTokenHash !== session.refreshTokenHash) {
        throw new AppError(401, "Invalid refresh token");
    }

    // 4. Revoke every active session in this login's token family.
    await this.sessionRepository.revokeFamily(
        session.familyId,
        "LOGOUT",
    );

    return {
        message: "Logged out successfully",
    };
}





async logoutAll(userId: string) {
    const result = await this.sessionRepository.revokeAllForUser(
        userId,
        "LOGOUT_ALL",
    );

    return {
        message: "Logged out from all devices successfully",
        sessionsRevoked: result.count,
    };
}


async updateProfile(userId: string, data: UpdateProfileDTO) {
    const user = await this.userRepository.updateProfile(
        userId,
        {
            name: data.name,
        },
    );

    return user;
}




async changePassword(userId: string, data: ChangePasswordDTO) {
    const user = await this.userRepository.findPasswordHashById(userId);

    if (!user) {
        throw new AppError(404, "User not found");
    }

    const passwordMatches = await comparePassword(
        data.currentPassword,
        user.passwordHash,
    );

    if (!passwordMatches) {
        throw new AppError(401, "Current password is incorrect");
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await this.userRepository.updatePassword(
        userId,
        newPasswordHash,
    );

    // Revoke existing sessions so old credentials cannot continue
    // to access the account from other devices.
    await this.sessionRepository.revokeAllForUser(
        userId,
        "PASSWORD_CHANGED",
    );

    return {
        message: "Password changed successfully. Please log in again.",
    };
}



async deleteAccount(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
        throw new AppError(404, "User not found");
    }

    await this.userRepository.deleteById(userId);

    return {
        message: "Account deleted successfully",
    };
}


async getAccountStats(userId: string) {
    const stats = await this.userRepository.getAccountStats(userId);

    if (!stats) {
        throw new AppError(404, "User not found");
    }

    return {
        createdAt: stats.createdAt,
        totalFollowedShows: stats._count.follows,
        totalListeningHistory: stats._count.listeningProgress,
    };
}

}