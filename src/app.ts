import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createMemoryStorage } from './adapters/memory/index.js';
import { createPostgresStorage } from './adapters/postgres/index.js';
import type { AppConfig } from './config/index.js';
import { createEventService } from './modules/events/index.js';
import { createTicketService } from './modules/tickets/index.js';
import { createVolunteerService } from './modules/volunteers/index.js';
import { registerErrorHandler } from './platform/http/errors.js';
import { registerRoutes } from './platform/http/routes.js';
import { resolveVersion } from './platform/version.js';

/** Composition root: the service code is shared by memory and PostgreSQL adapters. */
export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
  });
  const version = resolveVersion(config.gitSha);
  registerErrorHandler(app);

  const pgStorage =
    config.storage === 'postgres' ? createPostgresStorage(config.databaseUrl) : null;
  const storage = pgStorage ?? createMemoryStorage();
  if (pgStorage) app.addHook('onClose', () => pgStorage.db.close());
  const events = createEventService(storage.events);
  const volunteers = createVolunteerService(storage.volunteers);
  const tickets = createTicketService(storage.tickets, events);
  registerRoutes(app, { events, volunteers, tickets });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => {
    await pgStorage?.db.ping();
    return { status: 'ready', storage: config.storage };
  });
  app.get('/version', async () => ({ name: 'repair-cafe', version, storage: config.storage }));
  return app;
}
