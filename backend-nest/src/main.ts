import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { migrate } from './db/migrate';
import { ApiErrorFilter } from './common/error.filter';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const log = new Logger('Bootstrap');

  if (config.runMigrations) {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 1 });
    try {
      const ran = await migrate(pool);
      if (ran.length) log.log(`Applied migrations: ${ran.join(', ')}`);
    } finally {
      await pool.end();
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  // Behind Render or Vercel the caller's address is in X-Forwarded-For; trust one proxy hop so limits see real clients.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.use(helmet());
  app.enableCors({
    origin: config.corsAllowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 3600,
  });
  app.useGlobalFilters(new ApiErrorFilter());
  await app.listen(config.port, '0.0.0.0');
  log.log(`AlchemyX ERP API listening on port ${config.port}`);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
