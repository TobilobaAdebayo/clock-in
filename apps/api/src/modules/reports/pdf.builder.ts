import PDFDocument from 'pdfkit';
import { Stream } from 'node:stream';
import { AttendanceExportRow } from './excel.builder.js';
import { formatDateInTimezone } from '../../shared/utils/time.js';
import { env } from '../../config/env.js';

interface ColumnDef {
  label: string;
  x: number;
  width: number;
}

const COLUMNS: ColumnDef[] = [
  { label: 'S/N', x: 40, width: 32 },
  { label: 'Visitor Name', x: 72, width: 138 },
  { label: 'Phone Number', x: 210, width: 108 },
  { label: 'Here To See', x: 318, width: 125 },
  { label: 'Date', x: 443, width: 100 },
  { label: 'Time In', x: 543, width: 72 },
  { label: 'Time Out', x: 615, width: 72 },
  { label: 'Status', x: 687, width: 115 },
];

export class PdfReportBuilder {
  /**
   * Streams a formatted landscape A4 PDF attendance report directly to an HTTP response / writable stream.
   */
  static async renderToStream(
    rows: AttendanceExportRow[],
    outputStream: Stream.Writable,
    options: { title: string; timezone?: string },
  ): Promise<void> {
    const timezone = options.timezone || env.WORKSPACE_TIMEZONE;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40,
        bufferPages: true,
      });

      outputStream.on('finish', resolve);
      outputStream.on('error', reject);
      doc.on('error', reject);

      doc.pipe(outputStream);

      const drawHeader = () => {
        doc
          .fillColor('#34526E')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(env.WORKSPACE_NAME || 'Dare Adeboye Innovation Hub', 40, 36);

        doc
          .fillColor('#6B7A8C')
          .fontSize(10)
          .font('Helvetica')
          .text(
            `${options.title}  |  Generated: ${formatDateInTimezone(new Date(), timezone, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}`,
            40,
            58,
          );
      };

      const drawTableHeader = (y: number) => {
        doc.rect(40, y, 762, 24).fill('#34526E');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5);
        for (const col of COLUMNS) {
          doc.text(col.label, col.x + 6, y + 7, { width: col.width - 10, ellipsis: true });
        }
        return y + 24;
      };

      drawHeader();
      let y = drawTableHeader(84);

      if (rows.length === 0) {
        doc
          .fillColor('#6B7A8C')
          .font('Helvetica')
          .fontSize(10)
          .text('No attendance records found for the selected criteria.', 40, y + 18);
      } else {
        rows.forEach((record, index) => {
          if (y > 530) {
            doc.addPage();
            drawHeader();
            y = drawTableHeader(84);
          }

          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F7F9FB';
          doc.rect(40, y, 762, 22).fill(rowBg);
          doc.moveTo(40, y + 22).lineTo(802, y + 22).strokeColor('#E6ECF2').lineWidth(0.5).stroke();

          const checkInDate = new Date(record.checkIn);
          const dateFormatted = formatDateInTimezone(checkInDate, timezone, { dateStyle: 'medium' });
          const timeInFormatted = formatDateInTimezone(checkInDate, timezone, { timeStyle: 'short' });
          const timeOutFormatted = record.checkOut
            ? formatDateInTimezone(new Date(record.checkOut), timezone, { timeStyle: 'short' })
            : '—';
          const statusText = record.checkOut ? 'Checked Out' : 'Currently Checked In';

          const values = [
            String(index + 1),
            record.visitor.fullName,
            record.visitor.phoneNumber,
            record.hostName || '—',
            dateFormatted,
            timeInFormatted,
            timeOutFormatted,
            statusText,
          ];

          doc.fillColor('#1F2937').font('Helvetica').fontSize(9);
          COLUMNS.forEach((col, i) => {
            doc.text(values[i], col.x + 6, y + 6, { width: col.width - 10, ellipsis: true });
          });

          y += 22;
        });
      }

      doc.end();
    });
  }
}
