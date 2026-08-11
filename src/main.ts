// backend/src/main.ts

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. Production Security Headers (Helmet)
  app.use(helmet());

  // 2. Cookie Parser middleware (Must be before CORS and route handlers)
  app.use(cookieParser());

  // 3. Prevent Denial of Service (DoS) by limiting payload sizes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // 4. Robust, Dynamic CORS policy matching
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://wordtabernacle.org.ng',
    'https://www.wordtabernacle.org.ng',
    'https://portal.wordtabernacle.org.ng',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

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

  // 5. API prefixing
  app.setGlobalPrefix('api');

  // 6. Global Exception Handlers & Type Validators
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 7. Graceful Shutdown Hook Management
  app.enableShutdownHooks();

  const port = process.env.PORT || 5000;
  await app.listen(port);

  logger.log(`🚀 Production API is running in ${process.env.NODE_ENV || 'development'} mode on port: ${port}`);
}

bootstrap();