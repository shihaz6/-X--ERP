import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

type HttpHandler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Promise<HttpHandler> | null = null;

async function createServer(): Promise<HttpHandler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  configureApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance() as HttpHandler;
}

/**
 * Vercel entry point (see api/index.js). The Nest app is created once per warm instance and reused.
 * If creation fails, the next request tries again instead of reusing the failure.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  server ??= createServer().catch(err => {
    server = null;
    throw err;
  });
  const handle = await server;
  handle(req, res);
}
