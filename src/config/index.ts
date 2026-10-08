export interface AppConfig {
  port: number;
  host: string;
  gitSha: string | undefined;
  logLevel: string;
  storage: 'memory' | 'postgres';
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  const storage = env.STORAGE ?? 'memory';
  if (storage !== 'memory' && storage !== 'postgres') {
    throw new Error(`Invalid STORAGE: ${storage} (memory | postgres)`);
  }
  if (storage === 'postgres' && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for PostgreSQL storage');
  }
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    gitSha: env.GIT_SHA,
    logLevel: env.LOG_LEVEL ?? 'info',
    storage,
    databaseUrl: env.DATABASE_URL ?? '',
  };
}
