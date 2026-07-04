import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CryptoService } from './services/crypto.service';
import type { StringValue } from 'ms';
import { AuthTokenService } from './services/auth-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthPasswordService } from './services/auth-password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailModule } from '../email/email.module';
import { AuthLockService } from './services/auth-lock.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshTokenStrategy } from './strategies/refresh.strategy';
import { AuthEmailService } from './services/auth-email.service';
import { RolesGuard } from './guards/roles.guard';
import { AuthUserService } from './services/auth-user.service';

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
    CryptoService,
    PrismaService,
    UsersService,

    JwtStrategy,
    LocalStrategy,
    RefreshTokenStrategy,

    RolesGuard,
    AuthTokenService,
    AuthPasswordService,
    AuthLockService,
    AuthEmailService,
    AuthUserService,
  ],

  exports: [
    AuthService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}