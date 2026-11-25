import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { loadConfig } from './config';
import { ApiErrorFilter } from './common/error.filter';

/** HTTP setup shared by the local server (main.ts) and the serverless function (serverless.ts). */
export function configureApp(app: INestApplication): void {
  const config = loadConfig();
  // Behind Render or Vercel the caller's address is in X-Forwarded-For; trust one proxy hop so limits see real clients.
  app.getHttpAdapter().getInstance().set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.use(helmet());
  app.enableCors({
    origin: config.corsAllowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 3600,
  });
  app.useGlobalFilters(new ApiErrorFilter());
}
