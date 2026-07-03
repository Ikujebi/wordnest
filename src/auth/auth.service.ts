import {
    Injectable,
    Logger,
    UnauthorizedException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as argon2 from 'argon2';
import type { StringValue } from 'ms';

import { Role } from '../../app/generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { TokenPair } from './interfaces/token-pair.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Prisma } from '../../app/generated/prisma/client';
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
          private readonly emailService: EmailService,
    ) { }

    // ============================
    // PUBLIC METHODS
    // ============================

    /**
 * Validate user credentials.
 * Used by LocalStrategy and the login endpoint.
 */
async validateUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const normalizedEmail =
    this.normalizeEmail(email);

  const user =
    await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: {
        member: {
          select: {
            id: true,
          },
        },
      },
    });

  if (!user) {
    return null;
  }

  if (user.deletedAt) {
    throw new UnauthorizedException(
      'Account no longer exists.',
    );
  }

  if (!user.isActive) {
    throw new ForbiddenException(
      'Your account has been disabled.',
    );
  }

  if (
    this.isAccountLocked(
      user.lockedUntil,
    )
  ) {
    throw new ForbiddenException(
      'Your account is temporarily locked. Please try again later.',
    );
  }

  const passwordMatches =
    await this.verifyPassword(
      user.passwordHash,
      password,
    );

  if (!passwordMatches) {
    await this.incrementFailedLoginAttempts(
      user.id,
      user.failedLoginAttempts,
    );

    return null;
  }



  return this.mapAuthenticatedUser(user);
}

    /**
 * Register a new user.
 */
/**
 * Register a new user.
 */
/**
 * Register a new user.
 */
async register(
  dto: RegisterDto,
): Promise<LoginResponse> {
  const email = this.normalizeEmail(
    dto.email,
  );

  const existingUser =
    await this.usersService.findUserByEmail(
      email,
    );

  if (existingUser) {
    throw new ConflictException(
      'An account with this email already exists.',
    );
  }

  const passwordHash =
    await this.hashPassword(
      dto.password,
    );

  const user =
    await this.prisma.user.create({
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

      include: {
        member: {
          select: {
            id: true,
          },
        },
      },
    });

  const authenticatedUser =
    this.mapAuthenticatedUser(user);

  const tokens =
    await this.generateTokens(
      authenticatedUser,
    );

  // Persist the refresh token and create the audit log atomically.
  await this.prisma.$transaction(
    async (tx) => {
      await this.updateRefreshToken(
        user.id,
        tokens.refreshToken,
        tx,
      );

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'REGISTER',
          entity: 'User',
          entityId: user.id,
        },
      });
    },
  );

  // Send the verification email after the transaction succeeds.
  await this.sendVerificationEmail(
    authenticatedUser,
  );

  this.logger.log(
    `New user registered: ${user.email}`,
  );

  return {
    user: authenticatedUser,
    tokens,
  };
}
/**
 * Authenticate a user.
 */
/**
 * Authenticate a user.
 */
/**
 * Authenticate a user.
 */
async login(
  dto: LoginDto,
): Promise<LoginResponse> {
  const email = this.normalizeEmail(
    dto.email,
  );

  const user =
    await this.prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        member: {
          select: {
            id: true,
          },
        },
      },
    });

  // Never reveal whether the email exists.
  if (!user) {
    throw new UnauthorizedException(
      'Invalid email or password.',
    );
  }

  if (user.deletedAt) {
    throw new UnauthorizedException(
      'Invalid email or password.',
    );
  }

  if (!user.isActive) {
    throw new ForbiddenException(
      'Your account has been disabled.',
    );
  }

  if (
    this.isAccountLocked(
      user.lockedUntil,
    )
  ) {
    throw new ForbiddenException(
      'Your account is temporarily locked. Please try again later.',
    );
  }

  const validPassword =
    await this.verifyPassword(
      user.passwordHash,
      dto.password,
    );

  if (!validPassword) {
    await this.incrementFailedLoginAttempts(
      user.id,
      user.failedLoginAttempts,
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
      },
    });

    throw new UnauthorizedException(
      'Invalid email or password.',
    );
  }

  await this.resetFailedLoginAttempts(
    user.id,
  );

  /**
   * Require verified email.
   *
   * You can disable this with:
   * REQUIRE_EMAIL_VERIFICATION=false
   */
  const requireVerification =
    this.configService.get<string>(
      'REQUIRE_EMAIL_VERIFICATION',
      'true',
    ) === 'true';

  if (
    requireVerification &&
    !user.emailVerified
  ) {
    throw new ForbiddenException(
      'Please verify your email before logging in.',
    );
  }

  const authenticatedUser =
    this.mapAuthenticatedUser(
      user,
    );

  const tokens =
    await this.generateTokens(
      authenticatedUser,
    );

  await this.prisma.$transaction(
    async (tx) => {
      await this.updateRefreshToken(
        user.id,
        tokens.refreshToken,
        tx,
      );

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
        },
      });
    },
  );

  this.logger.log(
    `User ${user.email} logged in successfully.`,
  );

  return {
    user: authenticatedUser,
    tokens,
  };
}
/**
 * Refresh access and refresh tokens.
 */
/**
 * Refresh a user's access and refresh tokens.
 */
async refresh({
  userId,
  refreshToken,
}: {
  userId: string;
  refreshToken: string;
}): Promise<TokenPair> {
  const user = await this.prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      member: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      'User no longer exists.',
    );
  }

  if (user.deletedAt) {
    throw new UnauthorizedException(
      'Account no longer exists.',
    );
  }

  if (!user.isActive) {
    throw new ForbiddenException(
      'Account has been disabled.',
    );
  }

  if (!user.refreshTokenHash) {
    throw new UnauthorizedException(
      'Session has expired. Please log in again.',
    );
  }

  const validRefreshToken =
    await this.verifyRefreshToken(
      user.refreshTokenHash,
      refreshToken,
    );

  if (!validRefreshToken) {
    throw new UnauthorizedException(
      'Invalid refresh token.',
    );
  }

  const authenticatedUser =
    this.mapAuthenticatedUser(
      user,
    );

  const tokens =
    await this.generateTokens(
      authenticatedUser,
    );

  await this.prisma.$transaction(
    async (tx) => {
      await this.updateRefreshToken(
        user.id,
        tokens.refreshToken,
        tx,
      );

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'TOKEN_REFRESH',
          entity: 'User',
          entityId: user.id,
        },
      });
    },
  );

  this.logger.log(
    `Tokens refreshed for user ${user.email}.`,
  );

  return tokens;
}
/**
 * Logout the current user.
 */
async logout(
  userId: string,
): Promise<{
  message: string;
}> {
  const user =
    await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

  if (!user) {
    throw new UnauthorizedException(
      'User not found.',
    );
  }

  await this.prisma.$transaction([
    this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: null,
      },
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

  this.logger.log(
    `User ${userId} logged out successfully.`,
  );

  return {
    message: 'Logged out successfully.',
  };
}
/**
 * Get the currently authenticated user.
 */
async me(
  userId: string,
): Promise<AuthenticatedUser> {
  const user =
    await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,

        isActive: true,
        emailVerified: true,

        member: {
          select: {
            id: true,
          },
        },
      },
    });

  if (!user) {
    throw new UnauthorizedException(
      'User not found.',
    );
  }

  if (!user.isActive) {
    throw new ForbiddenException(
      'Your account has been disabled.',
    );
  }

  return this.mapAuthenticatedUser(user);
}
/**
 * Send a password reset email.
 *
 * Always returns the same response to prevent
 * email enumeration attacks.
 */
async forgotPassword(
  dto: ForgotPasswordDto,
): Promise<{
  message: string;
}> {
  const email = this.normalizeEmail(
    dto.email,
  );

  const user =
    await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        deletedAt: true,
      },
    });

  /**
   * Never reveal whether an account exists.
   */
  if (
    !user ||
    !user.isActive ||
    user.deletedAt
  ) {
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  const rawToken =
    this.generateSecureToken();

  const tokenHash =
    await this.hashPassword(rawToken);

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 30,
  );

  await this.prisma.$transaction([
    this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    }),

    this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),

    this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUEST',
        entity: 'User',
        entityId: user.id,
      },
    }),
  ]);

  const frontendUrl =
    this.configService.getOrThrow<string>(
      'FRONTEND_URL',
    );

  const resetUrl =
    `${frontendUrl}/reset-password?token=${rawToken}`;

  await this.emailService.sendEmail(
    user.email,
    'Reset your password',
    `
      <p>Hello ${user.fullName},</p>

      <p>You requested a password reset.</p>

      <p>
        <a href="${resetUrl}">
          Reset Password
        </a>
      </p>

      <p>
        This link expires in 30 minutes.
      </p>

      <p>
        If you did not request this,
        you can safely ignore this email.
      </p>
    `,
  );

  this.logger.log(
    `Password reset email sent to ${user.email}`,
  );

  return {
    message:
      'If an account with that email exists, a password reset link has been sent.',
  };
}
/**
 * Reset a user's password.
 */
async resetPassword(
  dto: ResetPasswordDto,
): Promise<{
  message: string;
}> {
  const activeTokens =
    await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            member: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

  let matchedToken:
    | (typeof activeTokens)[number]
    | null = null;

  for (const token of activeTokens) {
    const valid =
      await argon2.verify(
        token.tokenHash,
        dto.token,
      );

    if (valid) {
      matchedToken = token;
      break;
    }
  }

  if (!matchedToken) {
    throw new UnauthorizedException(
      'Invalid or expired password reset token.',
    );
  }

  const user = matchedToken.user;

  if (!user.isActive) {
    throw new ForbiddenException(
      'Account has been disabled.',
    );
  }

  if (user.deletedAt) {
    throw new UnauthorizedException(
      'Account no longer exists.',
    );
  }

  const passwordHash =
    await this.hashPassword(
      dto.password,
    );

  await this.prisma.$transaction([
    this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,

        refreshTokenHash: null,

        passwordChangedAt:
          new Date(),

        failedLoginAttempts: 0,

        lockedUntil: null,
      },
    }),

    this.prisma.passwordResetToken.update({
      where: {
        id: matchedToken.id,
      },
      data: {
        usedAt: new Date(),
      },
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

  this.logger.log(
    `Password reset completed for ${user.email}`,
  );

  return {
    message:
      'Password has been reset successfully.',
  };
}
/**
 * Verify a user's email address.
 */
async verifyEmail(
  token: string,
): Promise<{
  message: string;
}> {
  const activeTokens =
    await this.prisma.emailVerificationToken.findMany({
      where: {
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            member: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

  let matchedToken:
    | (typeof activeTokens)[number]
    | null = null;

  for (const verificationToken of activeTokens) {
    const valid =
      await argon2.verify(
        verificationToken.tokenHash,
        token,
      );

    if (valid) {
      matchedToken = verificationToken;
      break;
    }
  }

  if (!matchedToken) {
    throw new UnauthorizedException(
      'Invalid or expired verification link.',
    );
  }

  const user = matchedToken.user;

  if (!user.isActive) {
    throw new ForbiddenException(
      'Account has been disabled.',
    );
  }

  if (user.deletedAt) {
    throw new UnauthorizedException(
      'Account no longer exists.',
    );
  }

  if (user.emailVerified) {
    return {
      message:
        'Email has already been verified.',
    };
  }

  await this.prisma.$transaction([
    this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    }),

    this.prisma.emailVerificationToken.update({
      where: {
        id: matchedToken.id,
      },
      data: {
        usedAt: new Date(),
      },
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

  this.logger.log(
    `Email verified for ${user.email}`,
  );

  return {
    message:
      'Email verified successfully.',
  };
}
/**
 * Resend the email verification link.
 */
async resendVerificationEmail(
  userId: string,
): Promise<{
  message: string;
}> {
  const user = await this.prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      emailVerified: true,
      isActive: true,
      deletedAt: true,
      member: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      'User not found.',
    );
  }

  if (user.deletedAt) {
    throw new UnauthorizedException(
      'Account no longer exists.',
    );
  }

  if (!user.isActive) {
    throw new ForbiddenException(
      'Account has been disabled.',
    );
  }

  if (user.emailVerified) {
    return {
      message:
        'Email has already been verified.',
    };
  }

  await this.sendVerificationEmail(
    this.mapAuthenticatedUser(user),
  );

  this.logger.log(
    `Verification email resent to ${user.email}`,
  );

  return {
    message:
      'A new verification email has been sent.',
  };
}
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
 * Normalize email before storing or querying.
 */
private normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
/**
 * Send an email verification link.
 */
private async sendVerificationEmail(
  user: AuthenticatedUser,
): Promise<void> {
  const rawToken =
    this.generateSecureToken();

  const tokenHash =
    await this.hashPassword(rawToken);

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24,
  );

  await this.prisma.emailVerificationToken.deleteMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
  });

  await this.prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const frontendUrl =
    this.configService.getOrThrow<string>(
      'FRONTEND_URL',
    );

  const verificationUrl =
    `${frontendUrl}/verify-email?token=${rawToken}`;

  await this.emailService.sendEmail(
    user.email,
    'Verify your email address',
    `
      <h2>Welcome to WordNest</h2>

      <p>Hello ${user.fullName},</p>

      <p>
        Please verify your email address by clicking the button below.
      </p>

      <p>
        <a
          href="${verificationUrl}"
          style="
            display:inline-block;
            padding:12px 24px;
            background:#2563eb;
            color:#fff;
            text-decoration:none;
            border-radius:6px;
          "
        >
          Verify Email
        </a>
      </p>

      <p>
        This link expires in 24 hours.
      </p>

      <p>
        If you did not create this account,
        simply ignore this email.
      </p>
    `,
  );

  await this.prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'EMAIL_VERIFICATION_SENT',
      entity: 'User',
      entityId: user.id,
    },
  });

  this.logger.log(
    `Verification email sent to ${user.email}`,
  );
}
/**
 * Hash a password before storing it.
 */
private async hashPassword(
  password: string,
): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}
/**
 * Generate a cryptographically secure token.
 */
private generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}
/**
 * Verify a refresh token against its stored hash.
 */
private async verifyRefreshToken(
  refreshTokenHash: string,
  refreshToken: string,
): Promise<boolean> {
  return argon2.verify(refreshTokenHash, refreshToken);
}
    /**
     * Hash and store refresh token.
     */
  private async updateRefreshToken(
  userId: string,
  refreshToken: string,
  tx: Prisma.TransactionClient = this.prisma,
): Promise<void> {
  const refreshTokenHash = await argon2.hash(
    refreshToken,
    {
      type: argon2.argon2id,
    },
  );

  await tx.user.update({
    where: {
      id: userId,
    },
    data: {
      refreshTokenHash,
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
 * Verify a plain password against its stored hash.
 */
private async verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
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