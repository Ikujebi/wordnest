import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../prisma/prisma.service';

import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>(
        'JWT_REFRESH_SECRET',
      ),

      passReqToCallback: true,
    });
  }

  async validate(
    req: Request & {
      headers: {
        authorization?: string;
      };
    },
    payload: JwtPayload,
  ) {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        'Refresh token is missing.',
      );
    }

    const refreshToken = authorization.replace(
      'Bearer ',
      '',
    );

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        refreshTokenHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Account has been disabled.',
      );
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException(
        'No active session.',
      );
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      refreshToken,
    };
  }
}