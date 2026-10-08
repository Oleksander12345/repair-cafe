import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { assertIsolatedTestDatabase, resetTestDatabase } from './pg-fixture.js';

export const EVENT_OPEN = '11111111-1111-4111-8111-111111111111';
export const EVENT_CLOSED = '22222222-2222-4222-8222-222222222222';
export const OLENA = 'aaaaaaaa-0000-4000-8000-000000000001'; // electronics, appliances
export const TARAS = 'aaaaaaaa-0000-4000-8000-000000000002'; // bicycles
export const MYKOLA = 'aaaaaaaa-0000-4000-8000-000000000004'; // electronics, furniture

const storage = process.env.TEST_STORAGE === 'postgres' ? 'postgres' : 'memory';
const databaseUrl =
  storage === 'postgres' ? assertIsolatedTestDatabase(process.env.TEST_DATABASE_URL) : undefined;
export const config = {
  ...loadConfig({ STORAGE: storage, DATABASE_URL: databaseUrl, GIT_SHA: 'test-sha' }),
  logLevel: 'silent',
};

/** Fresh app with a clean queue in the selected storage adapter. */
export async function freshApp(): Promise<FastifyInstance> {
  if (storage === 'postgres') await resetTestDatabase(config.databaseUrl);
  const app = buildApp(config);
  await app.ready();
  return app;
}

let seq = 0;
export const key = (p = 'k') => `${p}-${Date.now()}-${++seq}-xxxxxxxx`;

export function register(
  app: FastifyInstance,
  body: Record<string, unknown> = {},
  idem = key(),
  eventId = EVENT_OPEN,
) {
  return app.inject({
    method: 'POST',
    url: `/events/${eventId}/tickets`,
    headers: { 'idempotency-key': idem },
    payload: {
      visitorName: 'Ірина',
      itemDescription: 'Чайник не гріє',
      category: 'appliances',
      ...body,
    },
  });
}

export const claim = (app: FastifyInstance, ticketId: string, volunteerId: string) =>
  app.inject({ method: 'POST', url: `/tickets/${ticketId}/claim`, payload: { volunteerId } });

export const complete = (
  app: FastifyInstance,
  ticketId: string,
  volunteerId: string,
  outcome: string,
) =>
  app.inject({
    method: 'POST',
    url: `/tickets/${ticketId}/complete`,
    payload: { volunteerId, outcome },
  });
