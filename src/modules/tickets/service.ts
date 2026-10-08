import { DomainError } from '../../shared/errors.js';
import type { Category } from '../../shared/categories.js';
import { newId } from '../../shared/ids.js';
import type { Id } from '../../shared/ids.js';
import type { EventService } from '../events/index.js';
import type { VolunteerService } from '../volunteers/index.js';
import { assertTransition, canRepair } from './domain.js';
import type { Ticket } from './domain.js';
import type { TicketRepository } from './ports.js';

export interface RegisterTicketCommand {
  eventId: Id;
  visitorName: string;
  itemDescription: string;
  category: Category;
  idempotencyKey: string;
}

export function createTicketService(
  tickets: TicketRepository,
  events: EventService,
  volunteers: VolunteerService,
) {
  return {
    /** Записати річ у чергу сесії. Повтор з тим самим ключем повертає той самий тікет. */
    async register(cmd: RegisterTicketCommand): Promise<Ticket> {
      const existing = await tickets.findByIdempotencyKey(cmd.idempotencyKey);
      if (existing) return existing;
      const event = await events.getOpenEvent(cmd.eventId);
      if ((await tickets.countActiveInEvent(event.id)) >= event.ticketLimit) {
        throw new DomainError('CONFLICT', 'Queue for this event is full');
      }
      const ticket: Ticket = {
        ...cmd,
        id: newId(),
        status: 'queued',
        volunteerId: null,
        createdAt: new Date(),
      };
      await tickets.insert(ticket);
      return ticket;
    },

    /** Майстер бере річ у роботу. Двоє одночасно взяти одну річ не можуть. */
    async claim(ticketId: Id, volunteerId: Id): Promise<void> {
      const ticket = await tickets.findById(ticketId);
      if (!ticket) throw new DomainError('NOT_FOUND', `Ticket ${ticketId} not found`);
      const volunteer = await volunteers.getVolunteer(volunteerId);
      if (!canRepair(volunteer.skills, ticket.category)) {
        throw new DomainError('VALIDATION', `Volunteer cannot repair ${ticket.category}`);
      }
      if (await tickets.findActiveByVolunteer(volunteerId)) {
        throw new DomainError('CONFLICT', 'Volunteer already has an item in repair');
      }
      assertTransition(ticket.status, 'in_repair');
      const ok = await tickets.updateStatus(ticketId, 'queued', 'in_repair', volunteerId);
      if (!ok) throw new DomainError('CONFLICT', 'Ticket was claimed by someone else');
    },
  };
}
