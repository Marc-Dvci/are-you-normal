const DAY_MS = 86_400_000;

/** Midnight UTC of the given instant, in milliseconds. */
export const utcDayStart = (at: Date): number =>
  Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());

/** YYYY-MM-DD for the UTC day of the given instant. */
export const isoDay = (at: Date): string =>
  new Date(utcDayStart(at)).toISOString().slice(0, 10);

const parseDay = (day: string): number => {
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Invalid day: ${day}`);
  return ms;
};

/** Edition 1 falls on the epoch day; each UTC day after it adds one. */
export const editionOn = (at: Date, epochDay: string): number =>
  Math.floor((utcDayStart(at) - parseDay(epochDay)) / DAY_MS) + 1;

export const dayOfEdition = (edition: number, epochDay: string): string =>
  new Date(parseDay(epochDay) + (edition - 1) * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** The next UTC midnight after the given instant. */
export const nextEditionAt = (at: Date): Date =>
  new Date(utcDayStart(at) + DAY_MS);

export const formatEditionDate = (day: string): string =>
  new Date(parseDay(day)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
