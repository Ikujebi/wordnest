import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CommonModule } from './common/common.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { SearchModule } from './modules/search/search.module'; 

// 🔥 1. IMPORT YOUR THREE NEW ROLE MODULES HERE
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { AdminModule } from './modules/admin/admin.module';
import { MemberModule } from './modules/member/member.module';
import { PrayerRequestsModule } from './modules/prayer-requests/prayer-requests.module';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),

    PrismaModule,
    AuthModule,
    CloudinaryModule,
    CommonModule,
    CommunicationsModule,
    SearchModule, 
    PrayerRequestsModule,
    
    // 🔥 2. REGISTER THEM HERE IN THE IMPORTS ARRAY
    SuperAdminModule,
    AdminModule,
    MemberModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ✅ SINGLE SOURCE OF TRUTH FOR INTERCEPTORS
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}