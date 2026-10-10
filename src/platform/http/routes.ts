import type { FastifyInstance } from 'fastify';
import type { EventService } from '../../modules/events/index.js';
import type { Outcome, TicketService } from '../../modules/tickets/index.js';
import { OUTCOMES } from '../../modules/tickets/index.js';
import type { VolunteerService } from '../../modules/volunteers/index.js';
import { CATEGORIES } from '../../shared/categories.js';

export interface Services {
  events: EventService;
  volunteers: VolunteerService;
  tickets: TicketService;
}

const uuid = { type: 'string', format: 'uuid' } as const;
const idParams = { type: 'object', required: ['id'], properties: { id: uuid } } as const;

export function registerRoutes(app: FastifyInstance, s: Services): void {
  app.get('/events', () => s.events.listEvents());
  app.get('/volunteers', () => s.volunteers.listVolunteers());

  app.get<{ Params: { id: string } }>(
    '/events/:id/queue',
    { schema: { params: idParams } },
    (req) => s.tickets.queue(req.params.id),
  );

  app.post<{
    Params: { id: string };
    Headers: { 'idempotency-key': string };
    Body: { visitorName: string; itemDescription: string; category: (typeof CATEGORIES)[number] };
  }>(
    '/events/:id/tickets',
    {
      schema: {
        params: idParams,
        headers: {
          type: 'object',
          required: ['idempotency-key'],
          properties: { 'idempotency-key': { type: 'string', pattern: '^[!-~]{8,100}$' } },
        },
        body: {
          type: 'object',
          required: ['visitorName', 'itemDescription', 'category'],
          additionalProperties: false,
          properties: {
            visitorName: { type: 'string' },
            itemDescription: { type: 'string' },
            category: { type: 'string', enum: [...CATEGORIES] },
          },
        },
      },
    },
    async (req, reply) => {
      const { ticket, created } = await s.tickets.register({
        ...req.body,
        eventId: req.params.id,
        idempotencyKey: req.headers['idempotency-key'],
      });
      return reply.status(created ? 201 : 200).send(ticket);
    },
  );

  app.get<{ Params: { id: string } }>('/tickets/:id', { schema: { params: idParams } }, (req) =>
    s.tickets.get(req.params.id),
  );

  const volunteerBody = {
    type: 'object',
    required: ['volunteerId'],
    additionalProperties: false,
    properties: { volunteerId: uuid },
  } as const;

  app.post<{ Params: { id: string }; Body: { volunteerId: string } }>(
    '/tickets/:id/claim',
    { schema: { params: idParams, body: volunteerBody } },
    (req) => s.tickets.claim(req.params.id, req.body.volunteerId),
  );

  app.post<{ Params: { id: string }; Body: { volunteerId: string; outcome: Outcome } }>(
    '/tickets/:id/complete',
    {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['volunteerId', 'outcome'],
          additionalProperties: false,
          properties: { volunteerId: uuid, outcome: { type: 'string', enum: [...OUTCOMES] } },
        },
      },
    },
    (req) => s.tickets.complete(req.params.id, req.body.volunteerId, req.body.outcome),
  );

  app.post<{ Params: { id: string } }>(
    '/tickets/:id/requeue',
    { schema: { params: idParams } },
    (req) => s.tickets.requeue(req.params.id),
  );
  app.post<{ Params: { id: string } }>(
    '/tickets/:id/withdraw',
    { schema: { params: idParams } },
    (req) => s.tickets.withdraw(req.params.id),
  );
}
