import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as argon2 from 'argon2';

import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponse } from './interfaces/login-response.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async generateTokens(
  userId: string,
  email: string,
  role: string,
) {
  const payload: JwtPayload = {
    sub: userId,
    email,
    role,
  };

  const accessToken = await this.jwtService.signAsync(payload, {
    secret: this.configService.get<string>('JWT_SECRET'),
    expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN'),
  });

  const refreshToken = await this.jwtService.signAsync(payload, {
    secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
  });

  return {
    accessToken,
    refreshToken,
  };
}

private async updateRefreshToken(
  userId: string,
  refreshToken: string,
) {
  const hash = await argon2.hash(refreshToken);

  await this.prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      refreshTokenHash: hash,
    },
  });
}

async register(dto: RegisterDto) {
  const email = dto.email.trim().toLowerCase();

  const exists = await this.prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (exists) {
    throw new ConflictException(
      'Email already exists.',
    );
  }

  const passwordHash = await argon2.hash(dto.password);

  const user = await this.prisma.user.create({
    data: {
      email,
      fullName: dto.fullName.trim(),
      passwordHash,
    },
  });

  const tokens = await this.generateTokens(
    user.id,
    user.email,
    user.role,
  );

  await this.updateRefreshToken(
    user.id,
    tokens.refreshToken,
  );

  return {
    user,
    tokens,
  };
}

async login(dto: LoginDto): Promise<LoginResponse> {
  const email = dto.email.trim().toLowerCase();

  const user = await this.prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      'Invalid email or password.',
    );
  }

  const validPassword = await argon2.verify(
    user.passwordHash,
    dto.password,
  );

  if (!validPassword) {
    throw new UnauthorizedException(
      'Invalid email or password.',
    );
  }

  const tokens = await this.generateTokens(
    user.id,
    user.email,
    user.role,
  );

  await this.updateRefreshToken(
    user.id,
    tokens.refreshToken,
  );

  await this.prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
    },
  });

  return {
    user,
    tokens,
  };
}
async refresh(dto: RefreshTokenDto) {
  const payload = await this.jwtService.verifyAsync(
    dto.refreshToken,
    {
      secret:
        this.configService.get<string>(
          'JWT_REFRESH_SECRET',
        ),
    },
  );

  const user = await this.prisma.user.findUnique({
    where: {
      id: payload.sub,
    },
  });

  if (!user || !user.refreshTokenHash) {
    throw new UnauthorizedException();
  }

  const valid = await argon2.verify(
    user.refreshTokenHash,
    dto.refreshToken,
  );

  if (!valid) {
    throw new UnauthorizedException();
  }

  const tokens = await this.generateTokens(
    user.id,
    user.email,
    user.role,
  );

  await this.updateRefreshToken(
    user.id,
    tokens.refreshToken,
  );

  return tokens;
}
async logout(userId: string) {
  await this.prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      refreshTokenHash: null,
    },
  });

  return {
    message: 'Logged out successfully.',
  };
}
async me(userId: string) {
  return this.prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      member: true,
    },
  });
}
async forgotPassword(dto: ForgotPasswordDto) {
  this.logger.log(
    `Password reset requested for ${dto.email}`,
  );

  return {
    message:
      'If an account exists, a reset email will be sent.',
  };
}
async resetPassword(dto: ResetPasswordDto) {
  this.logger.log(
    `Password reset attempt with token ${dto.token}`,
  );

  return {
    message: 'Password reset functionality coming soon.',
  };
}

}