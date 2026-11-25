import { PrismaClient } from '@prisma/client';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../shared/utils/phone.js';

export interface HistoricalAttendanceRow {
  lineNumber: number;
  fullName: string;
  phoneNumber: string;
  checkIn: Date;
  checkOut: Date | null;
}

export interface CsvRowError {
  lineNumber: number;
  reason: string;
}

export interface ParsedCsvResult {
  validRows: HistoricalAttendanceRow[];
  errors: CsvRowError[];
}

export interface HistoricalImportSummary {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  parseErrors: CsvRowError[];
  visitorsCreated: number;
  visitorsMatched: number;
  attendancesCreated: number;
  attendancesSkipped: number;
  importErrors: CsvRowError[];
}

/**
 * Splits a single CSV line while respecting double-quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses and validates historical paper-register CSV content.
 * Expected columns: full_name,phone_number,check_in,check_out
 */
export function parseHistoricalCsv(csvContent: string): ParsedCsvResult {
  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim());

  const validRows: HistoricalAttendanceRow[] = [];
  const errors: CsvRowError[] = [];

  if (lines.length === 0 || !lines[0]) {
    return { validRows, errors: [{ lineNumber: 1, reason: 'CSV file is empty.' }] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIdx = {
    fullName: headers.indexOf('full_name'),
    phoneNumber: headers.indexOf('phone_number'),
    checkIn: headers.indexOf('check_in'),
    checkOut: headers.indexOf('check_out'),
  };

  if (colIdx.fullName === -1 || colIdx.phoneNumber === -1 || colIdx.checkIn === -1) {
    return {
      validRows,
      errors: [
        {
          lineNumber: 1,
          reason: 'Missing required CSV headers. Expected at least: full_name,phone_number,check_in (optional: check_out).',
        },
      ],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineNumber = i + 1;
    const cols = splitCsvLine(line);

    const fullName = (cols[colIdx.fullName] || '').trim();
    const rawPhone = (cols[colIdx.phoneNumber] || '').trim();
    const rawCheckIn = (cols[colIdx.checkIn] || '').trim();
    const rawCheckOut = colIdx.checkOut >= 0 ? (cols[colIdx.checkOut] || '').trim() : '';

    if (fullName.length < 2 || fullName.length > 100) {
      errors.push({ lineNumber, reason: `Invalid full_name "${fullName}" (must be 2-100 chars).` });
      continue;
    }

    if (!isValidPhoneNumber(rawPhone)) {
      errors.push({ lineNumber, reason: `Invalid phone_number "${rawPhone}".` });
      continue;
    }

    const checkIn = new Date(rawCheckIn);
    if (isNaN(checkIn.getTime())) {
      errors.push({ lineNumber, reason: `Invalid check_in timestamp "${rawCheckIn}".` });
      continue;
    }

    let checkOut: Date | null = null;
    if (rawCheckOut) {
      checkOut = new Date(rawCheckOut);
      if (isNaN(checkOut.getTime())) {
        errors.push({ lineNumber, reason: `Invalid check_out timestamp "${rawCheckOut}".` });
        continue;
      }
      if (checkOut <= checkIn) {
        errors.push({ lineNumber, reason: 'check_out must be strictly after check_in.' });
        continue;
      }
    }

    validRows.push({
      lineNumber,
      fullName,
      phoneNumber: normalizePhoneNumber(rawPhone),
      checkIn,
      checkOut,
    });
  }

  return { validRows, errors };
}

/**
 * Imports validated historical paper-register rows into PostgreSQL idempotently.
 * Skips duplicate (visitorId + checkIn) records and enforces the single-active-session rule.
 */
export async function importHistoricalRows(
  rows: HistoricalAttendanceRow[],
  db: Pick<PrismaClient, 'visitor' | 'attendance'>,
  options: { dryRun?: boolean } = {},
): Promise<Omit<HistoricalImportSummary, 'totalRows' | 'parseErrors'>> {
  const dryRun = Boolean(options.dryRun);
  let visitorsCreated = 0;
  let visitorsMatched = 0;
  let attendancesCreated = 0;
  let attendancesSkipped = 0;
  const importErrors: CsvRowError[] = [];

  const seenVisitors = new Map<string, string>();

  for (const row of rows) {
    try {
      let visitorId = seenVisitors.get(row.phoneNumber);

      if (!visitorId) {
        const existingVisitor = await db.visitor.findUnique({
          where: { phoneNumber: row.phoneNumber },
        });

        if (existingVisitor) {
          visitorId = existingVisitor.id;
          visitorsMatched++;
        } else {
          if (dryRun) {
            visitorId = `dry-run-${row.phoneNumber}`;
          } else {
            const created = await db.visitor.create({
              data: {
                fullName: row.fullName,
                phoneNumber: row.phoneNumber,
              },
            });
            visitorId = created.id;
          }
          visitorsCreated++;
        }
        seenVisitors.set(row.phoneNumber, visitorId);
      }

      if (!dryRun || !visitorId.startsWith('dry-run-')) {
        const duplicate = await db.attendance.findFirst({
          where: { visitorId, checkIn: row.checkIn },
        });
        if (duplicate) {
          attendancesSkipped++;
          continue;
        }

        if (row.checkOut === null) {
          const existingOpen = await db.attendance.findFirst({
            where: { visitorId, checkOut: null },
          });
          if (existingOpen) {
            importErrors.push({
              lineNumber: row.lineNumber,
              reason: 'Skipped open session because visitor already has an active check-in.',
            });
            attendancesSkipped++;
            continue;
          }
        }
      }

      if (!dryRun) {
        await db.attendance.create({
          data: {
            visitorId,
            checkIn: row.checkIn,
            checkOut: row.checkOut,
          },
        });
      }
      attendancesCreated++;
    } catch (err) {
      importErrors.push({
        lineNumber: row.lineNumber,
        reason: err instanceof Error ? err.message : 'Unknown database import error',
      });
    }
  }

  return {
    dryRun,
    validRows: rows.length,
    visitorsCreated,
    visitorsMatched,
    attendancesCreated,
    attendancesSkipped,
    importErrors,
  };
}
