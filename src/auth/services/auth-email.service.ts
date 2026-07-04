import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { AuthTokenService } from './auth-token.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AuthEmailService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly tokenService: AuthTokenService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Generate a verification token, invalidate pending duplicates, and dispatch a verification email.
     */
    async sendVerificationEmail(user: AuthenticatedUser): Promise<void> {
        const rawToken = this.tokenService.generateOpaqueToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 Hours

        await this.prisma.$transaction([
            this.prisma.emailVerificationToken.deleteMany({
                where: { userId: user.id, usedAt: null },
            }),
            this.prisma.emailVerificationToken.create({
                data: { 
                    userId: user.id, 
                    token: rawToken, // 👈 Using schema's exact property name
                    expiresAt 
                },
            }),
        ]);

        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
        const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

        await this.emailService.sendEmail(
            user.email,
            'Verify your email address',
            `<h2>Welcome to WordNest</h2><p>Hello ${user.fullName},</p><p><a href="${verificationUrl}">Verify Email</a></p>`,
        );
    }

    /**
     * Generate a password reset token, invalidate previous unused tokens, and send out the password reset email link.
     */
    async sendPasswordResetEmail(user: any): Promise<void> {
        const rawToken = this.tokenService.generateOpaqueToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 1); // 1 Hour lifespan

        await this.prisma.$transaction([
            this.prisma.passwordResetToken.deleteMany({
                where: { userId: user.id, usedAt: null },
            }),
            this.prisma.passwordResetToken.create({
                data: { 
                    userId: user.id, 
                    token: rawToken, // 👈 Using schema's exact property name
                    expiresAt 
                },
            }),
        ]);

        const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
        const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

        await this.emailService.sendEmail(
            user.email,
            'Reset your password',
            `<h2>Password Reset Request</h2><p>Hello ${user.fullName},</p><p>Click the link below to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link will expire in 1 hour.</p>`,
        );
    }

    /**
     * Locate and validate a password reset token instantly via database index.
     */
    async validatePasswordResetToken(rawToken: string) {
        return this.prisma.passwordResetToken.findFirst({
            where: {
                token: rawToken, // 👈 Exact lookups prevent CPU blocking
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });
    }

    /**
     * Locate and validate an email verification token instantly via database index.
     */
    async validateEmailVerificationToken(rawToken: string) {
        return this.prisma.emailVerificationToken.findFirst({
            where: {
                token: rawToken, // 👈 Exact lookups prevent CPU blocking
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            include: { user: true },
        });
    }
}