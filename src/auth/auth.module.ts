import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { StringValue } from 'ms';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailModule } from '../email/email.module';

import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshTokenStrategy } from './strategies/refresh.strategy';

import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,

    EmailModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn:
            configService.getOrThrow<StringValue>(
              'JWT_ACCESS_EXPIRES_IN',
            ),
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,

    PrismaService,
    UsersService,

    JwtStrategy,
    LocalStrategy,
    RefreshTokenStrategy,

    RolesGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}