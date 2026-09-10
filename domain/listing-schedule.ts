import type { OfficialListing } from './dashboard.ts';

export type ListingSchedule = {
  listingId: string;
  title: string;
  agency: OfficialListing['agency'];
  startDate: string;
  endDate: string;
  daysUntilDeadline: number;
};

function toIsoDate(value: string, fallbackYear?: string): string | null {
  const numbers = value.trim().match(/\d+/g) ?? [];
  if (numbers.length >= 3) {
    const year = numbers[0]!;
    const month = numbers[1]!;
    const day = numbers[2]!;
    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (numbers.length === 1 && numbers[0].length === 8) {
    const digits = numbers[0];
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  }
  if (numbers.length >= 2 && fallbackYear) {
    return `${fallbackYear}-${numbers[0]!.padStart(2, '0')}-${numbers[1]!.padStart(2, '0')}`;
  }
  return null;
}

export function parseApplicationPeriod(period: string | undefined): { startDate: string; endDate: string } | null {
  if (!period) return null;
  const parts = period.split(/\s*(?:~|–|—|\u223c)\s*/);
  if (parts.length < 2) return null;
  const startDate = toIsoDate(parts[0]);
  let endDate = toIsoDate(parts[1], startDate?.slice(0, 4));
  if (startDate && endDate && endDate < startDate && !/\d{4}/.test(parts[1] ?? '')) {
    endDate = `${Number(startDate.slice(0, 4)) + 1}${endDate.slice(4)}`;
  }
  return startDate && endDate ? { startDate, endDate } : null;
}

function atLocalMidnight(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function createListingSchedule(listing: OfficialListing, today = new Date()): ListingSchedule | null {
  const period = parseApplicationPeriod(listing.applicationPeriod);
  if (!period) return null;
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const deadline = atLocalMidnight(period.endDate);
  if (Number.isNaN(deadline.getTime())) return null;
  return {
    listingId: listing.id,
    title: listing.title,
    agency: listing.agency,
    ...period,
    daysUntilDeadline: Math.ceil((deadline.getTime() - todayMidnight.getTime()) / 86_400_000),
  };
}

export function datesInRange(startDate: string, endDate: string): string[] {
  const start = atLocalMidnight(startDate);
  const end = atLocalMidnight(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const output: string[] = [];
  for (const cursor = new Date(start); cursor <= end && output.length < 62; cursor.setDate(cursor.getDate() + 1)) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    output.push(`${year}-${month}-${day}`);
  }
  return output;
}
