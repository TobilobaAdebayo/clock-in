import ExcelJS from 'exceljs';
import { Stream } from 'node:stream';
import { formatDateInTimezone } from '../../shared/utils/time.js';
import { env } from '../../config/env.js';

export interface AttendanceExportRow {
  id: string;
  hostName?: string | null;
  checkIn: Date;
  checkOut: Date | null;
  visitor: {
    fullName: string;
    phoneNumber: string;
  };
}

export class ExcelReportBuilder {
  /**
   * Initializes a streaming Excel workbook writing directly to an output stream (e.g. Express Response).
   */
  static createStreamingWorkbook(stream: Stream.Writable) {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream,
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet('Attendance Report', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Column definitions
    worksheet.columns = [
      { header: 'S/N', key: 'sn', width: 8 },
      { header: 'Visitor Name', key: 'visitorName', width: 24 },
      { header: 'Phone Number', key: 'phoneNumber', width: 18 },
      { header: 'Here To See', key: 'hostName', width: 24 },
      { header: 'Attendance Date', key: 'attendanceDate', width: 18 },
      { header: 'Time In', key: 'timeIn', width: 14 },
      { header: 'Time Out', key: 'timeOut', width: 18 },
      { header: 'Attendance Status', key: 'attendanceStatus', width: 22 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Dark slate
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.commit();

    return { workbook, worksheet };
  }

  /**
   * Appends an attendance record to the worksheet with workspace-timezone formatting.
   */
  static addRow(
    worksheet: ExcelJS.Worksheet,
    record: AttendanceExportRow,
    serialNumber: number,
    timezone = env.WORKSPACE_TIMEZONE,
  ) {
    const checkInDate = new Date(record.checkIn);
    const dateFormatted = formatDateInTimezone(checkInDate, timezone, {
      dateStyle: 'medium',
    });
    const timeInFormatted = formatDateInTimezone(checkInDate, timezone, {
      timeStyle: 'short',
    });

    let timeOutFormatted = '—';
    let statusText = 'Currently Checked In';

    if (record.checkOut) {
      const checkOutDate = new Date(record.checkOut);
      timeOutFormatted = formatDateInTimezone(checkOutDate, timezone, {
        timeStyle: 'short',
      });
      statusText = 'Checked Out';
    }

    const row = worksheet.addRow({
      sn: serialNumber,
      visitorName: record.visitor.fullName,
      phoneNumber: record.visitor.phoneNumber,
      hostName: record.hostName || '—',
      attendanceDate: dateFormatted,
      timeIn: timeInFormatted,
      timeOut: timeOutFormatted,
      attendanceStatus: statusText,
    });

    row.height = 22;
    row.getCell('sn').alignment = { horizontal: 'center' };
    row.getCell('attendanceDate').alignment = { horizontal: 'center' };
    row.getCell('timeIn').alignment = { horizontal: 'center' };
    row.getCell('timeOut').alignment = { horizontal: 'center' };
    row.getCell('attendanceStatus').alignment = { horizontal: 'center' };

    row.commit();
  }
}
