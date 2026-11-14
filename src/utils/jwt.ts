import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./app-error";

export interface AccessTokenPayload {
    sub: string;
    role: "CUSTOMER" | "ADMIN";
}

export interface RefreshTokenPayload {
    sub: string;
    jti: string;
}

export function generateAccessToken(
  payload: AccessTokenPayload,
): string {
  return jwt.sign(
    payload,
    env.JWT_ACCESS_TOKEN_SECRET,
    {
      expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY,
    },
  );
}


export function verifyAccessToken(
  token: string,
): AccessTokenPayload {
  try {
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_TOKEN_SECRET,
    ) as JwtPayload;

    if (
      typeof decoded.sub !== "string" ||
      (decoded.role !== "CUSTOMER" &&
        decoded.role !== "ADMIN")
    ) {
      throw new AppError(
        401,
        "Invalid access token",
      );
    }

    return {
      sub: decoded.sub,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      401,
      "Invalid or expired access token",
    );
  }
}

export function generateRefreshToken(
  payload: RefreshTokenPayload,
): string {
  return jwt.sign(
    payload,
    env.JWT_REFRESH_TOKEN_SECRET,
    {
      expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY,
    },
  );
}


export function verifyRefreshToken(
  token: string,
): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(
      token,
      env.JWT_REFRESH_TOKEN_SECRET,
    ) as JwtPayload;

    if (
      typeof decoded.sub !== "string" ||
      typeof decoded.jti !== "string"
    ) {
      throw new AppError(
        401,
        "Invalid refresh token",
      );
    }

    return {
      sub: decoded.sub,
      jti: decoded.jti,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      401,
      "Invalid or expired refresh token",
    );
  }
}