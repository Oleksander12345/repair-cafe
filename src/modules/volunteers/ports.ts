import type { Id } from '../../shared/ids.js';
import type { Volunteer } from './domain.js';

export interface VolunteerRepository {
  findById(id: Id): Promise<Volunteer | null>;
}
