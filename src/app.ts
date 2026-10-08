import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './config/index.js';
import { registerErrorHandler } from './platform/http/errors.js';
import { resolveVersion } from './platform/version.js';

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
  });
  const version = resolveVersion();
  registerErrorHandler(app);
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/version', async () => ({ name: 'repair-cafe', version }));
  return app;
}
