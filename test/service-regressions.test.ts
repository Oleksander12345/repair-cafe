import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStorage } from '../src/adapters/memory/index.js';
import { createEventService } from '../src/modules/events/index.js';
import { createTicketService } from '../src/modules/tickets/index.js';

const eventId = '11111111-1111-4111-8111-111111111111';
const registration = {
  eventId,
  visitorName: 'Iryna',
  itemDescription: 'Broken kettle',
  category: 'appliances' as const,
  idempotencyKey: 'event-closed-replay',
};

test('an existing registration can be replayed after the event closes', async () => {
  const storage = createMemoryStorage();
  const service = createTicketService(storage.tickets, createEventService(storage.events));
  const first = await service.register(registration);
  const event = await storage.events.findById(eventId);
  assert.ok(event);
  event.status = 'closed';

  const replay = await service.register(registration);
  assert.equal(replay.created, false);
  assert.equal(replay.ticket.id, first.ticket.id);
  await assert.rejects(service.register({ ...registration, idempotencyKey: 'new-key' }), {
    code: 'CONFLICT',
  });
});
