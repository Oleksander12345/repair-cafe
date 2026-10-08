// Публічний API модуля volunteers.
export type { Category, Volunteer } from './domain.js';
export { CATEGORIES } from './domain.js';
export type { VolunteerRepository } from './ports.js';
export type { VolunteerService } from './service.js';
export { createVolunteerService } from './service.js';
