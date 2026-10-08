import type { FastifyInstance } from 'fastify';
import { DomainError } from '../../shared/errors.js';
import type { DomainErrorCode } from '../../shared/errors.js';

const STATUS: Record<DomainErrorCode, number> = { VALIDATION: 400, NOT_FOUND: 404, CONFLICT: 409 };

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof DomainError) {
      return reply.status(STATUS[err.code]).send({ error: err.code, message: err.message });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'INTERNAL', message: 'Internal error' });
  });
}
