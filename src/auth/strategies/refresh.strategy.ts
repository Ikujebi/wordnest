import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_REFRESH_SECRET',
        ),

      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ) {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        'Refresh token is missing.',
      );
    }

    const [scheme, refreshToken] =
      authorization.split(' ');

    if (
      scheme !== 'Bearer' ||
      !refreshToken
    ) {
      throw new UnauthorizedException(
        'Invalid authorization header.',
      );
    }

    if (!payload.sub) {
      throw new UnauthorizedException(
        'Invalid refresh token payload.',
      );
    }

    return {
      userId: payload.sub,
      refreshToken,
    };
  }
}