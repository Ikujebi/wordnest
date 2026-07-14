// backend/src/main.ts

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Explicitly typing as NestExpressApplication to gain access to Express configuration methods
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // 1. Production Security Headers (Helmet)
  app.use(helmet());

  // 2. Prevent Denial of Service (DoS) by limiting payload sizes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // 3. Robust, Dynamic CORS policy matching
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://wordtabernacle.org.ng',
    'https://www.wordtabernacle.org.ng',
    'https://portal.wordtabernacle.org.ng',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server or programmatic requests (Postman, mobile clients, cron)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Safe logging of blocked origin attempts without exposing server secrets
      logger.warn(`CORS request blocked from unrecognized origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
    ],
    exposedHeaders: ['Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // 4. API prefixing
  app.setGlobalPrefix('api');

  // 5. Global Exception Handlers & Type Validators
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 6. Graceful Shutdown Hook Management
  // This allows NestJS to safely release database connections and free memory on process exit signals
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') || 5000;
  await app.listen(port);

  logger.log(`🚀 Production API is running in ${process.env.NODE_ENV || 'development'} mode on port: ${port}`);
}

bootstrap();