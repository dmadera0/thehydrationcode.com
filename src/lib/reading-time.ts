import readingTime from 'reading-time';

/** Reading time in whole minutes, computed from the raw article body. Never authored. */
export function getReadingMinutes(body: string): number {
  return Math.max(1, Math.ceil(readingTime(body).minutes));
}
