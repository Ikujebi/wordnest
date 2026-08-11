import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

import { JwtPayload } from '../interfaces/jwt-payload.interface';

function extractRefreshTokenFromCookie(req: Request): string | null {
  return req?.cookies?.refreshToken ?? null;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: extractRefreshTokenFromCookie,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = extractRefreshTokenFromCookie(req);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing.');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid refresh token payload.');
    }

    return {
      userId: payload.sub,
      refreshToken,
    };
  }
}