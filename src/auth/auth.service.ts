import {
    Injectable,
    Logger,
    UnauthorizedException,
    ForbiddenException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

import { AuthTokenService } from './services/auth-token.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthLockService } from './services/auth-lock.service';
import { AuthEmailService } from './services/auth-email.service';
import { AuthUserService } from './services/auth-user.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginResponse } from './interfaces/login-response.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { TokenPair } from './interfaces/token-pair.interface';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly usersService: UsersService,
        private readonly configService: ConfigService,
        private readonly tokenService: AuthTokenService,
        private readonly passwordService: AuthPasswordService,
        private readonly lockService: AuthLockService,
        private readonly emailService: AuthEmailService,
        private readonly userService: AuthUserService,
    ) {}

    /**
     * Validate a user's credentials for Passport local strategy.
     */
    async validateUser(email: string, pass: string): Promise<any> {
        const normalizedEmail = this.userService.normalizeEmail(email);
        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { member: { select: { id: true } } },
        });

        // Fail early if user doesn't exist, is deleted, or is inactive
        if (!user || user.deletedAt || !user.isActive) {
            return null;
        }

        // Check if the account is currently locked out
        if (this.lockService.isAccountLocked(user.lockedUntil)) {
            return null;
        }

        // Verify the password
        const validPassword = await this.passwordService.verify(user.passwordHash, pass);

        if (!validPassword) {
            // Track the failure just like you do in the login method
            await this.lockService.incrementFailedLoginAttempts(user.id);
            await this.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'LOGIN_FAILED',
                    entity: 'User',
                    entityId: user.id,
                },
            });
            return null;
        }

        // Reset tracking on successful validation
        await this.lockService.resetFailedLoginAttempts(user.id);

        // Strip out the password hash and return the authenticated user object
        return this.userService.mapAuthenticatedUser(user);
    }

    /**
     * Authenticate a user via email and password credentials.
     */
    async login(dto: LoginDto): Promise<LoginResponse> {
        const email = this.userService.normalizeEmail(dto.email);
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { member: { select: { id: true } } },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedException('Invalid email or password.');
        }

        if (!user.isActive) {
            throw new ForbiddenException('Your account has been disabled.');
        }

        if (this.lockService.isAccountLocked(user.lockedUntil)) {
            throw new ForbiddenException('Your account is temporarily locked. Please try again later.');
        }

        const validPassword = await this.passwordService.verify(user.passwordHash, dto.password);

        if (!validPassword) {
            // 👈 Fixed parameter signature to prevent brute-force memory bypasses
            await this.lockService.incrementFailedLoginAttempts(user.id);
            
            await this.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'LOGIN_FAILED',
                    entity: 'User',
                    entityId: user.id,
                },
            });
            throw new UnauthorizedException('Invalid email or password.');
        }

        const requireVerification = this.configService.get<string>('REQUIRE_EMAIL_VERIFICATION', 'true') === 'true';
        if (requireVerification && !user.emailVerified) {
            throw new ForbiddenException('Please verify your email before logging in.');
        }

        await this.lockService.resetFailedLoginAttempts(user.id);

        const authenticatedUser = this.userService.mapAuthenticatedUser(user);
        const tokens = await this.tokenService.generateTokens(authenticatedUser);

        // Update login metadata, track fresh tokens, and write operational log atomically
        await this.prisma.$transaction(async (tx) => {
            await this.tokenService.updateRefreshTokenHash(user.id, tokens.refreshToken, tx);
            await tx.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });
            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'LOGIN',
                    entity: 'User',
                    entityId: user.id,
                },
            });
        });

        this.logger.log(`User ${user.email} logged in successfully.`);
        return { user: authenticatedUser, tokens };
    }

    /**
     * Register a new user, build relational records, and dispatch verification alerts.
     */
    async register(dto: RegisterDto): Promise<LoginResponse> {
        const email = this.userService.normalizeEmail(dto.email);

        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
            throw new ConflictException('An account with this email already exists.');
        }

        const passwordHash = await this.passwordService.hash(dto.password);

        // Core registration transactional boundary
        const user = await this.prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    fullName: dto.fullName.trim(),
                    passwordHash,
                    role: Role.MEMBER,
                    isActive: true,
                    emailVerified: false,
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
                include: { member: { select: { id: true } } },
            });

            await tx.auditLog.create({
                data: {
                    userId: newUser.id,
                    action: 'REGISTER',
                    entity: 'User',
                    entityId: newUser.id,
                },
            });

            return newUser;
        });

        const authenticatedUser = this.userService.mapAuthenticatedUser(user);
        const tokens = await this.tokenService.generateTokens(authenticatedUser);

        await this.tokenService.updateRefreshTokenHash(user.id, tokens.refreshToken);
        
        // Dispatch outward mail routines cleanly without interrupting server threads
        await this.emailService.sendVerificationEmail(authenticatedUser);

        this.logger.log(`New user registered: ${user.email}`);
        return { user: authenticatedUser, tokens };
    }

    /**
     * Cycle active application JWT security values against persistent hash records.
     */
    async refresh({ userId, refreshToken }: { userId: string; refreshToken: string }): Promise<TokenPair> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { member: { select: { id: true } } },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedException('Account no longer exists.');
        }

        if (!user.isActive) {
            throw new ForbiddenException('Account has been disabled.');
        }

        const validRefreshToken = await this.tokenService.verifyRefreshToken(user.refreshTokenHash, refreshToken);
        if (!validRefreshToken) {
            throw new UnauthorizedException('Invalid refresh token.');
        }

        const authenticatedUser = this.userService.mapAuthenticatedUser(user);
        const tokens = await this.tokenService.generateTokens(authenticatedUser);

        await this.prisma.$transaction(async (tx) => {
            await this.tokenService.updateRefreshTokenHash(user.id, tokens.refreshToken, tx);
            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'TOKEN_REFRESH',
                    entity: 'User',
                    entityId: user.id,
                },
            });
        });

        this.logger.log(`Tokens refreshed for user ${user.email}.`);
        return tokens;
    }

    /**
     * Clear validation fingerprints and log the current session out.
     */
    async logout(userId: string): Promise<{ message: string }> {
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { refreshTokenHash: null },
            }),
            this.prisma.auditLog.create({
                data: {
                    userId,
                    action: 'LOGOUT',
                    entity: 'User',
                    entityId: userId,
                },
            }),
        ]);

        this.logger.log(`User ${userId} logged out successfully.`);
        return { message: 'Logged out successfully.' };
    }

    /**
     * Fetch the profile context profile payload of the current subject context.
     */
    async me(userId: string): Promise<AuthenticatedUser> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { member: { select: { id: true } } },
        });

        if (!user) {
            throw new UnauthorizedException('User not found.');
        }

        if (!user.isActive) {
            throw new ForbiddenException('Your account has been disabled.');
        }

        return this.userService.mapAuthenticatedUser(user);
    }

    /**
     * Request a verification signature string to reset a lost profile identity credential.
     */
    async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
        const email = this.userService.normalizeEmail(dto.email);
        const user = await this.prisma.user.findUnique({ where: { email } });

        const standardResponse = {
            message: 'If an account with that email exists, a password reset link has been sent.',
        };

        if (!user || !user.isActive || user.deletedAt) {
            return standardResponse;
        }

        await this.emailService.sendPasswordResetEmail(user);
        return standardResponse;
    }

    /**
     * Consume authentication check payloads to update authorization tokens securely.
     */
    async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
        const matchedToken = await this.emailService.validatePasswordResetToken(dto.token);
        if (!matchedToken) {
            throw new UnauthorizedException('Invalid or expired password reset token.');
        }

        const user = matchedToken.user;
        if (!user.isActive) {
            throw new ForbiddenException('Account has been disabled.');
        }
        if (user.deletedAt) {
            throw new UnauthorizedException('Account no longer exists.');
        }

        const passwordHash = await this.passwordService.hash(dto.password);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    refreshTokenHash: null,
                    passwordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: matchedToken.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'PASSWORD_RESET',
                    entity: 'User',
                    entityId: user.id,
                },
            }),
        ]);

        this.logger.log(`Password reset completed for ${user.email}`);
        return { message: 'Password has been reset successfully.' };
    }

    /**
     * Confirm ownership claims over a designated email contact context channel string.
     */
    async verifyEmail(token: string): Promise<{ message: string }> {
        const matchedToken = await this.emailService.validateEmailVerificationToken(token);
        if (!matchedToken) {
            throw new UnauthorizedException('Invalid or expired verification link.');
        }

        const user = matchedToken.user;
        if (!user.isActive) {
            throw new ForbiddenException('Account has been disabled.');
        }
        if (user.deletedAt) {
            throw new UnauthorizedException('Account no longer exists.');
        }

        if (user.emailVerified) {
            return { message: 'Email has already been verified.' };
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                },
            }),
            this.prisma.emailVerificationToken.update({
                where: { id: matchedToken.id },
                data: { usedAt: new Date() },
            }),
            this.prisma.emailVerificationToken.deleteMany({
                where: {
                    userId: user.id,
                    usedAt: null,
                },
            }),
            this.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'EMAIL_VERIFIED',
                    entity: 'User',
                    entityId: user.id,
                },
            }),
        ]);

        this.logger.log(`Email verified for ${user.email}`);
        return { message: 'Email verified successfully.' };
    }

    /**
     * Resend an unverified verification link message request out to the active user context profile.
     */
    async resendVerificationEmail(userId: string): Promise<{ message: string }> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { member: { select: { id: true } } },
        });

        if (!user) {
            throw new UnauthorizedException('User not found.');
        }
        if (user.deletedAt) {
            throw new UnauthorizedException('Account no longer exists.');
        }
        if (!user.isActive) {
            throw new ForbiddenException('Account has been disabled.');
        }
        if (user.emailVerified) {
            return { message: 'Email has already been verified.' };
        }

        const authenticatedUser = this.userService.mapAuthenticatedUser(user);
        await this.emailService.sendVerificationEmail(authenticatedUser);

        this.logger.log(`Verification email resent to ${user.email}`);
        return { message: 'A new verification email has been sent.' };
    }
}