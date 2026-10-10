import type { RepairEvent } from '../modules/events/index.js';
import type { Volunteer } from '../modules/volunteers/index.js';

/** Static prototype fixtures; PostgreSQL tests use the same records. */
export const SEED_EVENTS: RepairEvent[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Repair Café — Подол, жовтень',
    startsAt: new Date('2026-10-24T10:00:00Z'),
    endsAt: new Date('2026-10-24T15:00:00Z'),
    ticketLimit: 5,
    status: 'open',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Repair Café — Оболонь, вересень',
    startsAt: new Date('2026-09-26T10:00:00Z'),
    endsAt: new Date('2026-09-26T15:00:00Z'),
    ticketLimit: 20,
    status: 'closed',
  },
];

export const SEED_VOLUNTEERS: Volunteer[] = [
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    name: 'Олена',
    skills: ['electronics', 'appliances'],
  },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Тарас', skills: ['bicycles'] },
  { id: 'aaaaaaaa-0000-4000-8000-000000000003', name: 'Ганна', skills: ['textile'] },
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000004',
    name: 'Микола',
    skills: ['electronics', 'furniture'],
  },
];
