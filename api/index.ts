import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import serverless from 'serverless-http';

import { AppModule } from '../src/app.module';

const expressApp = express();

let server: any;

async function bootstrap() {
  if (!server) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    app.setGlobalPrefix('api');

    app.enableCors({
      origin: true,
      credentials: true,
    });

    await app.init();

    server = serverless(expressApp);
  }

  return server;
}

export default async (req: any, res: any) => {
  const handler = await bootstrap();
  return handler(req, res);
};