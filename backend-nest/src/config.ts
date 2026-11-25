/** Runtime configuration, read once from environment variables. Names match the Spring backend where they overlap. */
export interface AppConfig {
  port: number;
  databaseUrl: string;
  dbPoolSize: number;
  timezone: string;
  corsAllowedOrigins: string[];
  sessionTtlMs: number;
  maxUploadBytes: number;
  frontendUrl: string;
  mailFrom: string;
  mail: { host: string; port: number; username: string; password: string };
  billingCron: string;
  overdueCron: string;
  runMigrations: boolean;
  /** Shared secret for the scheduled-job endpoints (Vercel Cron). Unset means the endpoints refuse all calls. */
  cronSecret: string;
  bootstrapAdmin: { username: string; email: string; password: string; name: string };
}

// Origins of the phone app. Always allowed; local web origins are only allowed outside production.
const NATIVE_ORIGINS = ['https://localhost', 'capacitor://localhost'];
const LOCAL_WEB_ORIGINS = ['http://localhost:5173', 'http://localhost:8443'];

/** Accepts "12h", "30m", "45s" or "7d". Falls back to 12 hours for anything else. */
export function parseDurationMs(value: string | undefined, fallbackMs = 12 * 60 * 60 * 1000): number {
  const match = /^(\d+)\s*([smhd])$/i.exec((value ?? '').trim());
  if (!match) return fallbackMs;
  const unit: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * unit[match[2].toLowerCase()];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL ?? '';
  return {
    port: Number(env.PORT ?? 8080),
    databaseUrl,
    dbPoolSize: Number(env.DB_POOL_SIZE ?? 5),
    timezone: env.APP_TIMEZONE ?? 'Asia/Colombo',
    corsAllowedOrigins: (env.CORS_ALLOWED_ORIGINS
      ?? [...(env.NODE_ENV === 'production' ? [] : LOCAL_WEB_ORIGINS), ...NATIVE_ORIGINS].join(','))
      .split(',').map(s => s.trim()).filter(Boolean),
    sessionTtlMs: parseDurationMs(env.SESSION_TTL),
    maxUploadBytes: 25 * 1024 * 1024,
    frontendUrl: (env.FRONTEND_URL ?? 'http://localhost:8443').replace(/\/+$/, ''),
    mailFrom: env.MAIL_FROM ?? 'AlchemyX <no-reply@alchemyx.local>',
    mail: {
      host: env.MAIL_HOST ?? '',
      port: Number(env.MAIL_PORT ?? 587),
      username: env.MAIL_USERNAME ?? '',
      password: env.MAIL_PASSWORD ?? '',
    },
    billingCron: env.BILLING_CRON ?? '0 0 6 * * *',
    overdueCron: env.OVERDUE_CRON ?? '0 0 7 * * *',
    runMigrations: (env.RUN_MIGRATIONS ?? 'true') !== 'false',
    cronSecret: env.CRON_SECRET ?? '',
    bootstrapAdmin: {
      username: env.BOOTSTRAP_ADMIN_USERNAME ?? '',
      email: env.BOOTSTRAP_ADMIN_EMAIL ?? '',
      password: env.BOOTSTRAP_ADMIN_PASSWORD ?? '',
      name: env.BOOTSTRAP_ADMIN_NAME ?? 'Administrator',
    },
  };
}
