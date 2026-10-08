import { DomainError } from '../../shared/errors.js';
import { newId } from '../../shared/ids.js';
import type { Id } from '../../shared/ids.js';
import type { EventService } from '../events/index.js';
import { assertTransition, canRepair, isSameRegistration, validateRegistration } from './domain.js';
import type { Outcome, RegistrationInput, Ticket, TicketTransition } from './domain.js';
import type { QueueItem, TicketStore } from './ports.js';

export interface RegisterTicketCommand extends RegistrationInput {
  idempotencyKey: string;
}

export interface TicketService {
  register(cmd: RegisterTicketCommand): Promise<{ ticket: Ticket; created: boolean }>;
  claim(ticketId: Id, volunteerId: Id): Promise<Ticket>;
  complete(ticketId: Id, volunteerId: Id, outcome: Outcome): Promise<Ticket>;
  requeue(ticketId: Id): Promise<Ticket>;
  withdraw(ticketId: Id): Promise<Ticket>;
  get(ticketId: Id): Promise<{ ticket: Ticket; history: TicketTransition[] }>;
  queue(eventId: Id): Promise<QueueItem[]>;
}

export function createTicketService(store: TicketStore, events: EventService): TicketService {
  const transition = (
    t: Ticket,
    to: Ticket['status'],
    volunteerId: Id | null,
  ): TicketTransition => ({
    ticketId: t.id,
    fromStatus: t.status,
    toStatus: to,
    volunteerId,
    at: new Date(),
  });

  const mustFind = (t: Ticket | null, id: Id): Ticket => {
    if (!t) throw new DomainError('NOT_FOUND', `Ticket ${id} not found`);
    return t;
  };

  /** Transition without an assigned volunteer (requeue / withdraw). */
  const move = (ticketId: Id, to: Ticket['status']) =>
    store.transaction(async (tx) => {
      const ticket = mustFind(await tx.findById(ticketId), ticketId);
      assertTransition(ticket.status, to);
      const next: Ticket = { ...ticket, status: to, volunteerId: null };
      await tx.save(next);
      await tx.addTransition(transition(ticket, to, null));
      return next;
    });

  return {
    async register(cmd) {
      validateRegistration(cmd);
      const replay = (existing: Ticket) => {
        if (!isSameRegistration(existing, cmd)) {
          throw new DomainError(
            'CONFLICT',
            'Idempotency-Key was already used for a different request',
            'IDEMPOTENCY_KEY_REUSED',
          );
        }
        return { ticket: existing, created: false };
      };
      return store.transaction(async (tx) => {
        const existing = await tx.findByIdempotencyKey(cmd.idempotencyKey);
        if (existing) return replay(existing);
        const event = await tx.lockEventForRegistration(cmd.eventId);
        if (!event) throw new DomainError('NOT_FOUND', `Event ${cmd.eventId} not found`);
        if (event.status !== 'open') {
          throw new DomainError('CONFLICT', `Event ${cmd.eventId} is ${event.status}`);
        }
        if ((await tx.countActiveInEvent(event.id)) >= event.ticketLimit) {
          throw new DomainError('CONFLICT', 'Queue for this event is full', 'QUEUE_FULL');
        }
        const ticket: Ticket = {
          id: newId(),
          eventId: cmd.eventId,
          visitorName: cmd.visitorName.trim(),
          itemDescription: cmd.itemDescription.trim(),
          category: cmd.category,
          status: 'queued',
          volunteerId: null,
          idempotencyKey: cmd.idempotencyKey,
          createdAt: new Date(),
        };
        if ((await tx.insert(ticket)) === 'duplicate') {
          // Another transaction inserted the same key first.
          const winner = await tx.findByIdempotencyKey(cmd.idempotencyKey);
          if (!winner) throw new Error('Duplicate key reported but ticket not found');
          return replay(winner);
        }
        await tx.addTransition({
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: 'queued',
          volunteerId: null,
          at: ticket.createdAt,
        });
        return { ticket, created: true };
      });
    },

    async claim(ticketId, volunteerId) {
      return store.transaction(async (tx) => {
        const ticket = mustFind(await tx.findById(ticketId), ticketId);
        const volunteer = await tx.lockVolunteerForClaim(volunteerId);
        if (!volunteer) throw new DomainError('NOT_FOUND', `Volunteer ${volunteerId} not found`);
        if (!canRepair(volunteer.skills, ticket.category)) {
          throw new DomainError('VALIDATION', `Volunteer cannot repair ${ticket.category}`);
        }
        assertTransition(ticket.status, 'in_repair');
        if (await tx.findInRepairByVolunteer(volunteerId)) {
          throw new DomainError(
            'CONFLICT',
            'Volunteer already has an item in repair',
            'VOLUNTEER_BUSY',
          );
        }
        const next: Ticket = { ...ticket, status: 'in_repair', volunteerId };
        await tx.save(next);
        await tx.addTransition(transition(ticket, 'in_repair', volunteerId));
        return next;
      });
    },

    complete: (ticketId, volunteerId, outcome) =>
      store.transaction(async (tx) => {
        const ticket = mustFind(await tx.findById(ticketId), ticketId);
        if (ticket.volunteerId !== volunteerId) {
          throw new DomainError(
            'CONFLICT',
            'Only the assigned volunteer can finish',
            'NOT_ASSIGNEE',
          );
        }
        assertTransition(ticket.status, outcome);
        const next: Ticket = {
          ...ticket,
          status: outcome,
          volunteerId: outcome === 'needs_parts' ? null : volunteerId,
        };
        await tx.save(next);
        await tx.addTransition(transition(ticket, outcome, volunteerId));
        return next;
      }),

    requeue: (ticketId) => move(ticketId, 'queued'),
    withdraw: (ticketId) => move(ticketId, 'withdrawn'),

    async get(ticketId) {
      const ticket = mustFind(await store.findById(ticketId), ticketId);
      return { ticket, history: await store.history(ticketId) };
    },

    async queue(eventId) {
      await events.getEvent(eventId);
      return store.listQueue(eventId); // The adapter supplies the joined read model.
    },
  };
}
