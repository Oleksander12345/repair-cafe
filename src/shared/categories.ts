export const CATEGORIES = [
  'electronics',
  'appliances',
  'textile',
  'bicycles',
  'furniture',
] as const;

export type Category = (typeof CATEGORIES)[number];
