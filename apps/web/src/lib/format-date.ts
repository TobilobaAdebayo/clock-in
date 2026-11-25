/**
 * Workspace-consistent date, day, and time formatting helpers for the frontend.
 */

export const DEFAULT_WORKSPACE_TIMEZONE = 'Africa/Lagos';

export function formatDayAndDate(
  input: string | Date,
  options: { longMonth?: boolean; timeZone?: string } = {},
): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: options.longMonth ? 'long' : 'short',
    day: 'numeric',
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });
}

export function formatShortDayAndDate(input: string | Date, timeZone?: string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatTime(input: string | Date, timeZone?: string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}
