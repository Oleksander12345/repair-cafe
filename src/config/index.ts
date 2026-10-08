export interface AppConfig {
  port: number;
  host: string;
  gitSha: string | undefined;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    gitSha: env.GIT_SHA,
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
