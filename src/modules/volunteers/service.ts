import { DomainError } from '../../shared/errors.js';
import type { Id } from '../../shared/ids.js';
import type { Volunteer } from './domain.js';
import type { VolunteerRepository } from './ports.js';

export interface VolunteerService {
  getVolunteer(id: Id): Promise<Volunteer>;
  listVolunteers(): Promise<Volunteer[]>;
}

export function createVolunteerService(repo: VolunteerRepository): VolunteerService {
  return {
    async getVolunteer(id) {
      const v = await repo.findById(id);
      if (!v) throw new DomainError('NOT_FOUND', `Volunteer ${id} not found`);
      return v;
    },
    listVolunteers: () => repo.list(),
  };
}
