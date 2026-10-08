import type { FastifyError, FastifyInstance } from 'fastify';
import { DomainError, UnavailableError } from '../../shared/errors.js';
import type { DomainErrorCode } from '../../shared/errors.js';

const STATUS: Record<DomainErrorCode, number> = { VALIDATION: 400, NOT_FOUND: 404, CONFLICT: 409 };

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err instanceof DomainError) {
      return reply
        .status(STATUS[err.code])
        .send({ error: err.code, reason: err.reason ?? err.code, message: err.message });
    }
    if (err instanceof UnavailableError) {
      app.log.warn({ err }, 'storage unavailable');
      return reply
        .status(503)
        .header('Retry-After', '5')
        .send({ error: 'UNAVAILABLE', message: 'Storage temporarily unavailable, retry later' });
    }
    if (err.validation) {
      return reply
        .status(400)
        .send({ error: 'VALIDATION', reason: 'SCHEMA', message: err.message });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'INTERNAL', message: 'Internal error' });
  });
}
