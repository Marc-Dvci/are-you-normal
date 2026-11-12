import type { Category } from '../../shared/types';

const LABELS: Record<Category | 'community', string> = {
  travel: 'Travel',
  food: 'Food',
  sleep: 'Sleep',
  home: 'Home',
  manners: 'Manners',
  money: 'Money',
  work: 'Work',
  tech: 'Phones and screens',
  pets: 'Pets',
  hygiene: 'Washing up',
  social: 'People',
  leisure: 'Spare time',
  language: 'Words',
  culture: 'Films and music',
  holidays: 'Holidays',
  superstition: 'Superstition',
  community: 'Asked by a player',
};

export const topicLabel = (topic: Category | 'community'): string =>
  LABELS[topic];
