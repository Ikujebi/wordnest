import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { StringValue } from 'ms';

import { Prisma } from '@prisma/client'; // Adjust path if needed
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path if needed
import { CryptoService } from './crypto.service'; // Adjust path if needed

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenPair } from '../interfaces/token-pair.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AuthTokenService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly cryptoService: CryptoService,
        private readonly prisma: PrismaService, // 👈 Injected root prisma client
    ) {}

    /**
     * Generate access & refresh tokens.
     */
    async generateTokens(user: AuthenticatedUser): Promise<TokenPair> {
        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_SECRET'),
                expiresIn: this.configService.getOrThrow<StringValue>('JWT_ACCESS_EXPIRES_IN'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.getOrThrow<StringValue>('JWT_REFRESH_EXPIRES_IN'),
            }),
        ]);

        return { accessToken, refreshToken };
    }

    /**
     * Hash a raw refresh token and persist it to the user record.
     * Falls back to the root PrismaService context if no transactional client instance is passed.
     */
    async updateRefreshTokenHash(
        userId: string,
        refreshToken: string,
        tx: Prisma.TransactionClient = this.prisma, // 👈 Now optional, defaults to standard client
    ): Promise<void> {
        const refreshTokenHash = await this.cryptoService.hash(refreshToken);

        await tx.user.update({
            where: { id: userId },
            data: { refreshTokenHash },
        });
    }

    /**
     * Verify a raw incoming refresh token against the stored database hash.
     */
    async verifyRefreshToken(
        refreshTokenHash: string | null,
        refreshToken: string,
    ): Promise<boolean> {
        if (!refreshTokenHash) return false;
        return this.cryptoService.verify(refreshTokenHash, refreshToken);
    }

    /**
     * Generate a cryptographically secure opaque string token (e.g., for email confirmations/resets).
     */
    generateOpaqueToken(): string {
        return randomBytes(32).toString('hex');
    }
}