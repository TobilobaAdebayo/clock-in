/**
 * Workspace timezone and date calculation utilities.
 * Default timezone: Africa/Lagos (UTC+1, West Africa Time).
 */

export const DEFAULT_TIMEZONE = 'Africa/Lagos';

/**
 * Gets a zoned representation of the given date in the specified IANA timezone.
 */
export function getZonedDateParts(date: Date = new Date(), timezone = DEFAULT_TIMEZONE): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }

  return {
    year: map.year,
    month: map.month, // 1-12
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Parses a local date/time string in a timezone to an exact UTC Date object.
 */
export function parseZonedDateTime(isoLocalString: string, timezone = DEFAULT_TIMEZONE): Date {
  const [datePart, timePart = '00:00:00'] = isoLocalString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split('.')[0].split(':').map(Number);
  const ms = timePart.includes('.') ? parseInt(timePart.split('.')[1].padEnd(3, '0').slice(0, 3), 10) : 0;

  // 1. Initial UTC guess
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  
  // 2. What local time does this UTC timestamp produce in the target timezone?
  const zoned = getZonedDateParts(new Date(guessUtc), timezone);
  const zonedMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second, ms);
  
  // 3. Timezone offset in milliseconds
  const offsetMs = zonedMs - guessUtc;
  
  // 4. Exact UTC timestamp
  return new Date(guessUtc - offsetMs);
}

/**
 * Calculates start and end of day (in UTC) for a given date in workspace timezone.
 */
export function getDayBounds(date: Date = new Date(), timezone = DEFAULT_TIMEZONE): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const parts = getZonedDateParts(date, timezone);
  const y = parts.year;
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');

  const startUtc = parseZonedDateTime(`${y}-${m}-${d}T00:00:00.000`, timezone);
  const endUtc = parseZonedDateTime(`${y}-${m}-${d}T23:59:59.999`, timezone);

  return { startOfDay: startUtc, endOfDay: endUtc };
}

/**
 * Calculates start and end of the week (Monday to Sunday) in workspace timezone.
 */
export function getWeekBounds(date: Date = new Date(), timezone = DEFAULT_TIMEZONE): {
  startOfWeek: Date;
  endOfWeek: Date;
} {
  const zoned = getZonedDateParts(date, timezone);
  const currentZonedDate = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
  const dayOfWeek = currentZonedDate.getUTCDay(); // 0 = Sun, 1 = Mon ...
  const distanceToMonday = (dayOfWeek + 6) % 7;

  const monday = new Date(currentZonedDate);
  monday.setUTCDate(currentZonedDate.getUTCDate() - distanceToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const mYear = monday.getUTCFullYear();
  const mMonth = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const mDay = String(monday.getUTCDate()).padStart(2, '0');

  const sYear = sunday.getUTCFullYear();
  const sMonth = String(sunday.getUTCMonth() + 1).padStart(2, '0');
  const sDay = String(sunday.getUTCDate()).padStart(2, '0');

  return {
    startOfWeek: parseZonedDateTime(`${mYear}-${mMonth}-${mDay}T00:00:00.000`, timezone),
    endOfWeek: parseZonedDateTime(`${sYear}-${sMonth}-${sDay}T23:59:59.999`, timezone),
  };
}

/**
 * Calculates start and end of month in workspace timezone.
 */
export function getMonthBounds(date: Date = new Date(), timezone = DEFAULT_TIMEZONE): {
  startOfMonth: Date;
  endOfMonth: Date;
} {
  const zoned = getZonedDateParts(date, timezone);
  const y = zoned.year;
  const m = String(zoned.month).padStart(2, '0');
  
  // Last day of current month
  const lastDayNumber = new Date(Date.UTC(y, zoned.month, 0)).getUTCDate();
  const lastDay = String(lastDayNumber).padStart(2, '0');

  return {
    startOfMonth: parseZonedDateTime(`${y}-${m}-01T00:00:00.000`, timezone),
    endOfMonth: parseZonedDateTime(`${y}-${m}-${lastDay}T23:59:59.999`, timezone),
  };
}

/**
 * Formats a Date object for display in workspace timezone.
 */
export function formatDateInTimezone(
  date: Date,
  timezone = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  },
): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(date);
}
