import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { parseHistoricalCsv, importHistoricalRows } from '../src/modules/attendance/historical-import.js';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const fileFlagIndex = args.indexOf('--file');
  const filePathArg = fileFlagIndex >= 0 ? args[fileFlagIndex + 1] : undefined;
  const dryRun = args.includes('--dry-run');

  if (!filePathArg) {
    console.error('Usage: pnpm db:import-historical -- --file <path-to-register.csv> [--dry-run]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePathArg);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Reading historical paper register CSV: ${resolvedPath}${dryRun ? ' (DRY RUN)' : ''}`);
  const csvContent = fs.readFileSync(resolvedPath, 'utf8');
  const { validRows, errors: parseErrors } = parseHistoricalCsv(csvContent);

  if (parseErrors.length > 0) {
    console.warn(`Found ${parseErrors.length} CSV validation issue(s):`);
    for (const err of parseErrors) {
      console.warn(`  - Line ${err.lineNumber}: ${err.reason}`);
    }
  }

  const result = await importHistoricalRows(validRows, prisma, { dryRun });

  console.log('\nImport Summary:');
  console.log(`  Dry Run:              ${result.dryRun}`);
  console.log(`  Valid Rows Parsed:    ${result.validRows}`);
  console.log(`  Visitors Created:     ${result.visitorsCreated}`);
  console.log(`  Visitors Matched:     ${result.visitorsMatched}`);
  console.log(`  Attendances Created:  ${result.attendancesCreated}`);
  console.log(`  Attendances Skipped:  ${result.attendancesSkipped}`);
  console.log(`  Import Errors:        ${result.importErrors.length}`);

  if (result.importErrors.length > 0) {
    for (const err of result.importErrors) {
      console.error(`  - Line ${err.lineNumber}: ${err.reason}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('Historical import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
