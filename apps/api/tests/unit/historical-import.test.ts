import { describe, it, expect, vi } from 'vitest';
import { parseHistoricalCsv, importHistoricalRows } from '../../src/modules/attendance/historical-import.js';

describe('Historical Paper Register CSV Importer (M8)', () => {
  it('parses valid rows, normalizes Nigerian phones, and flags invalid rows', () => {
    const csv = [
      'full_name,phone_number,check_in,check_out',
      'Chinedu Okafor,08031234567,2026-11-20T08:30:00+01:00,2026-11-20T17:15:00+01:00',
      'Amina Yusuf,+2348098765432,2026-11-20T09:00:00+01:00,',
      'Bad Time,08055556666,2026-11-20T17:00:00+01:00,2026-11-20T09:00:00+01:00',
      'Bad Phone,123,2026-11-20T08:30:00+01:00,2026-11-20T12:00:00+01:00',
    ].join('\n');

    const { validRows, errors } = parseHistoricalCsv(csv);

    expect(validRows).toHaveLength(2);
    expect(validRows[0].phoneNumber).toBe('+2348031234567');
    expect(validRows[0].checkOut).toBeInstanceOf(Date);
    expect(validRows[1].phoneNumber).toBe('+2348098765432');
    expect(validRows[1].checkOut).toBeNull();

    expect(errors).toHaveLength(2);
    expect(errors[0].lineNumber).toBe(4);
    expect(errors[0].reason).toContain('check_out must be strictly after check_in');
    expect(errors[1].lineNumber).toBe(5);
  });

  it('supports dry-run mode without writing to the database', async () => {
    const csv = [
      'full_name,phone_number,check_in,check_out',
      'Chinedu Okafor,08031234567,2026-11-20T08:30:00+01:00,2026-11-20T17:15:00+01:00',
    ].join('\n');

    const { validRows } = parseHistoricalCsv(csv);
    const mockDb: any = {
      visitor: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      attendance: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    const summary = await importHistoricalRows(validRows, mockDb, { dryRun: true });

    expect(summary.dryRun).toBe(true);
    expect(summary.visitorsCreated).toBe(1);
    expect(summary.attendancesCreated).toBe(1);
    expect(mockDb.visitor.create).not.toHaveBeenCalled();
    expect(mockDb.attendance.create).not.toHaveBeenCalled();
  });

  it('skips duplicate attendance records and prevents duplicate active sessions', async () => {
    const csv = [
      'full_name,phone_number,check_in,check_out',
      'Chinedu Okafor,08031234567,2026-11-20T08:30:00+01:00,2026-11-20T17:15:00+01:00',
      'Chinedu Okafor,08031234567,2026-11-21T08:30:00+01:00,',
    ].join('\n');

    const { validRows } = parseHistoricalCsv(csv);
    const mockDb: any = {
      visitor: {
        findUnique: vi.fn().mockResolvedValue({ id: 'v-existing-1', phoneNumber: '+2348031234567' }),
        create: vi.fn(),
      },
      attendance: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'att-dup-1' })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'att-open-1', checkOut: null }),
        create: vi.fn(),
      },
    };

    const summary = await importHistoricalRows(validRows, mockDb, { dryRun: false });

    expect(summary.visitorsMatched).toBe(1);
    expect(summary.visitorsCreated).toBe(0);
    expect(summary.attendancesCreated).toBe(0);
    expect(summary.attendancesSkipped).toBe(2);
    expect(summary.importErrors).toHaveLength(1);
    expect(summary.importErrors[0].reason).toContain('active check-in');
    expect(mockDb.attendance.create).not.toHaveBeenCalled();
  });
});
