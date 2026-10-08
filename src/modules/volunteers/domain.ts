import type { Id } from '../../shared/ids.js';

export const CATEGORIES = [
  'electronics',
  'appliances',
  'textile',
  'bicycles',
  'furniture',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Майстер-волонтер і категорії речей, які він уміє лагодити. */
export interface Volunteer {
  id: Id;
  name: string;
  skills: Category[];
}
