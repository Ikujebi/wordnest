// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { CryptoService } from './services/crypto.service';
import { AuthTokenService } from './services/auth-token.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthLockService } from './services/auth-lock.service';
import { AuthEmailService } from './services/auth-email.service';
import { AuthUserService } from './services/auth-user.service';

import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshTokenStrategy } from './strategies/refresh.strategy';

import { RolesGuard } from './guards/roles.guard';

import { EmailModule } from '../email/email.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from "../modules/notifications/notification.module";
import { AuditLogModule } from '../modules/audit-log/audit-log.module';

@Module({
  imports: [
    EmailModule,
    CloudinaryModule,
    UsersModule,
    NotificationsModule,
    AuditLogModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<StringValue>('JWT_ACCESS_EXPIRES_IN'),
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,

    CryptoService,
    AuthTokenService,
    AuthPasswordService,
    AuthLockService,
    AuthEmailService,
    AuthUserService,

    JwtStrategy,
    LocalStrategy,
    RefreshTokenStrategy,

    RolesGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    AuthTokenService,
    AuthPasswordService,
    AuthUserService,
    AuthEmailService,
  ],
})
export class AuthModule {}