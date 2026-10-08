import { DomainError } from '../../shared/errors.js';
import type { Id } from '../../shared/ids.js';
import type { RepairEvent } from './domain.js';
import type { EventRepository } from './ports.js';

export interface EventService {
  getEvent(id: Id): Promise<RepairEvent>;
  /** Throw CONFLICT when the event does not accept tickets. */
  getOpenEvent(id: Id): Promise<RepairEvent>;
  listEvents(): Promise<RepairEvent[]>;
}

export function createEventService(repo: EventRepository): EventService {
  const getEvent = async (id: Id) => {
    const event = await repo.findById(id);
    if (!event) throw new DomainError('NOT_FOUND', `Event ${id} not found`);
    return event;
  };
  return {
    getEvent,
    async getOpenEvent(id) {
      const event = await getEvent(id);
      if (event.status !== 'open')
        throw new DomainError('CONFLICT', `Event ${id} is ${event.status}`);
      return event;
    },
    listEvents: () => repo.list(),
  };
}
