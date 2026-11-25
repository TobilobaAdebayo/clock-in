import { describe, it, expect } from 'vitest';
import {
  getZonedDateParts,
  getDayBounds,
  getWeekBounds,
  getMonthBounds,
  formatDateInTimezone,
} from '../../src/shared/utils/time.js';

describe('Timezone & Date Utilities', () => {
  const lagosTimezone = 'Africa/Lagos'; // UTC+1

  describe('Zoned Date Parts', () => {
    it('accurately extracts local date parts for Africa/Lagos (UTC+1)', () => {
      // 2026-11-24 11:30:00 UTC = 12:30:00 in Africa/Lagos
      const utcDate = new Date(Date.UTC(2026, 10, 24, 11, 30, 0));
      const parts = getZonedDateParts(utcDate, lagosTimezone);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(11); // 1-indexed
      expect(parts.day).toBe(24);
      expect(parts.hour).toBe(12);
      expect(parts.minute).toBe(30);
    });
  });

  describe('Midnight Boundary Conditions', () => {
    it('handles exact midnight in Africa/Lagos', () => {
      // 2026-11-24 23:00:00 UTC is exactly 2026-11-25 00:00:00 in Lagos (UTC+1)
      const boundaryDate = new Date(Date.UTC(2026, 10, 24, 23, 0, 0));
      const parts = getZonedDateParts(boundaryDate, lagosTimezone);

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(11);
      expect(parts.day).toBe(25);
      expect(parts.hour).toBe(0);
      expect(parts.minute).toBe(0);
    });

    it('1 second before midnight belongs to previous day in Lagos', () => {
      // 2026-11-24 22:59:59 UTC = 2026-11-24 23:59:59 in Lagos
      const justBeforeMidnight = new Date(Date.UTC(2026, 10, 24, 22, 59, 59));
      const parts = getZonedDateParts(justBeforeMidnight, lagosTimezone);

      expect(parts.day).toBe(24);
      expect(parts.hour).toBe(23);
      expect(parts.minute).toBe(59);
    });
  });

  describe('Day Bounds', () => {
    it('returns startOfDay at local 00:00:00 and endOfDay at local 23:59:59', () => {
      const refDate = new Date(Date.UTC(2026, 10, 24, 14, 0, 0));
      const bounds = getDayBounds(refDate, lagosTimezone);

      // Lagos is UTC+1, so local 00:00:00 corresponds to 23:00:00 UTC previous day
      expect(bounds.startOfDay.getTime()).toBeLessThan(bounds.endOfDay.getTime());
      
      const startParts = getZonedDateParts(bounds.startOfDay, lagosTimezone);
      expect(startParts.day).toBe(24);
      expect(startParts.hour).toBe(0);
      expect(startParts.minute).toBe(0);
      expect(startParts.second).toBe(0);

      const endParts = getZonedDateParts(bounds.endOfDay, lagosTimezone);
      expect(endParts.day).toBe(24);
      expect(endParts.hour).toBe(23);
      expect(endParts.minute).toBe(59);
    });
  });

  describe('Week & Month Bounds', () => {
    it('calculates start and end of week (Monday to Sunday)', () => {
      const tuesday = new Date(Date.UTC(2026, 10, 24, 12, 0, 0)); // Tuesday
      const weekBounds = getWeekBounds(tuesday, lagosTimezone);

      const startParts = getZonedDateParts(weekBounds.startOfWeek, lagosTimezone);
      const endParts = getZonedDateParts(weekBounds.endOfWeek, lagosTimezone);

      // Monday is 23rd Nov 2026
      expect(startParts.day).toBe(23);
      expect(startParts.hour).toBe(0);

      // Sunday is 29th Nov 2026
      expect(endParts.day).toBe(29);
      expect(endParts.hour).toBe(23);
    });

    it('calculates start and end of month for November (30 days)', () => {
      const midNov = new Date(Date.UTC(2026, 10, 15, 12, 0, 0));
      const monthBounds = getMonthBounds(midNov, lagosTimezone);

      const startParts = getZonedDateParts(monthBounds.startOfMonth, lagosTimezone);
      const endParts = getZonedDateParts(monthBounds.endOfMonth, lagosTimezone);

      expect(startParts.day).toBe(1);
      expect(startParts.hour).toBe(0);

      expect(endParts.day).toBe(30);
      expect(endParts.hour).toBe(23);
    });
  });

  describe('Formatting in Timezone', () => {
    it('formats date according to workspace timezone', () => {
      const date = new Date(Date.UTC(2026, 10, 24, 11, 0, 0));
      const formatted = formatDateInTimezone(date, lagosTimezone);
      expect(formatted).toContain('2026');
      expect(formatted).toContain('12:00'); // UTC+1
    });
  });
});
