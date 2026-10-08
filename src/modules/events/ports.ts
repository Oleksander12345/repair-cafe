import type { Id } from '../../shared/ids.js';
import type { RepairEvent } from './domain.js';

export interface EventRepository {
  findById(id: Id): Promise<RepairEvent | null>;
  list(): Promise<RepairEvent[]>;
}
