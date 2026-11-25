import { loadConfig, AppConfig } from './config';

/** Injection token for the loaded configuration. */
export const CONFIG = Symbol('CONFIG');
export type { AppConfig };

export const configProvider = { provide: CONFIG, useFactory: (): AppConfig => loadConfig() };
