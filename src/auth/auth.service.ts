import {
    Injectable,
    Logger,
    UnauthorizedException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as argon2 from 'argon2';
import type { StringValue } from 'ms';

import { Role } from '../../app/generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { TokenPair } from './interfaces/token-pair.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { LoginResponse } from './interfaces/login-response.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    private static readonly MAX_FAILED_ATTEMPTS = 5;

    private static readonly LOCK_TIME_MINUTES = 15;

    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // ============================
    // PUBLIC METHODS
    // ============================

    async register(dto: RegisterDto): Promise<LoginResponse>
    async login(dto: LoginDto): Promise<LoginResponse>
    async refresh(...)

    /**
     * Generate access & refresh tokens.
     */
    private async generateTokens(
        user: AuthenticatedUser,
    ): Promise<TokenPair> {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_SECRET'),
                expiresIn: this.configService.getOrThrow<StringValue>(
                    'JWT_ACCESS_EXPIRES_IN',
                ),
            }),

            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>(
                    'JWT_REFRESH_SECRET',
                ),
                expiresIn: this.configService.getOrThrow<StringValue>(
                    'JWT_REFRESH_EXPIRES_IN',
                ),
            }),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }

    /**
     * Hash and store refresh token.
     */
    private async updateRefreshToken(
        userId: string,
        refreshToken: string,
    ): Promise<void> {
        const hash = await argon2.hash(refreshToken, {
            type: argon2.argon2id,
        });

        await this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                refreshTokenHash: hash,
            },
        });
    }

    /**
     * Convert Prisma user into authenticated user.
     */
    private mapAuthenticatedUser(
        user: {
            id: string;
            email: string;
            fullName: string;
            role: AuthenticatedUser['role'];
            emailVerified: boolean;
            isActive: boolean;
            member: {
                id: string;
            } | null;
        },
    ): AuthenticatedUser {
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            emailVerified: user.emailVerified,
            isActive: user.isActive,
            memberId: user.member?.id ?? null,
        };
    }

    /**
     * Check whether account is currently locked.
     */
    private isAccountLocked(
        lockedUntil: Date | null,
    ): boolean {
        return !!lockedUntil && lockedUntil > new Date();
    }

    /**
     * Reset failed login attempts.
     */
    private async resetFailedLoginAttempts(
        userId: string,
    ): Promise<void> {
        await this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    }

    /**
     * Increment failed login attempts and lock account if necessary.
     */
    private async incrementFailedLoginAttempts(
        userId: string,
        attempts: number,
    ): Promise<void> {
        const failedAttempts = attempts + 1;

        const lockedUntil =
            failedAttempts >= AuthService.MAX_FAILED_ATTEMPTS
                ? new Date(
                    Date.now() +
                    AuthService.LOCK_TIME_MINUTES * 60 * 1000,
                )
                : null;

        await this.prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                failedLoginAttempts: failedAttempts,
                lockedUntil,
            },
        });
    }
}