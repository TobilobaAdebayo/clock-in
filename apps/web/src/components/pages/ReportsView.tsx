'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { getAccessToken } from '../../lib/auth-context';
import { PageHeader } from '../layout';
import { Button, Card } from '../ui';

type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' | 'VISITOR';
type ExportFormat = 'xlsx' | 'pdf';

export function ReportsView() {
  const [reportType, setReportType] = useState<ReportType>('DAILY');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDownload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (reportType === 'CUSTOM') {
      if (!startDate || !endDate) {
        setErrorMessage('Please provide both Start Date and End Date.');
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setErrorMessage('Start Date cannot be after End Date.');
        return;
      }
    }

    if (reportType === 'VISITOR' && !visitorId.trim()) {
      setErrorMessage('Please enter a Visitor ID.');
      return;
    }

    try {
      setDownloading(true);

      const params = new URLSearchParams({
        type: reportType,
        format,
        ...(reportType === 'DAILY' || reportType === 'WEEKLY' || reportType === 'MONTHLY'
          ? { date }
          : {}),
        ...(reportType === 'CUSTOM' ? { startDate, endDate } : {}),
        ...(reportType === 'VISITOR' ? { visitorId: visitorId.trim() } : {}),
        ...(status !== 'ALL' ? { status } : {}),
      });

      const token = getAccessToken();
      const response = await fetch(`/api/v1/reports/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        let errText = 'Failed to generate report';
        try {
          const json = await response.json();
          errText = json.error?.message || json.message || errText;
        } catch {
          // non-JSON
        }
        throw new Error(errText);
      }

      let filename = `attendance_${reportType.toLowerCase()}_report.${format}`;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) filename = matches[1];
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSuccessMessage(`Downloaded ${filename}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while downloading the report.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        eyebrow="DARE ADEBOYE INNOVATION HUB"
        title="Reports"
        description="Download attendance reports in Excel or PDF format."
      />

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleDownload} className="space-y-6">
          {/* Report Scope */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1F2937] mb-2.5">
              Report Scope
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {(
                [
                  { id: 'DAILY', label: 'Daily', desc: 'Single day' },
                  { id: 'WEEKLY', label: 'Weekly', desc: 'Mon – Sun' },
                  { id: 'MONTHLY', label: 'Monthly', desc: 'Full month' },
                  { id: 'CUSTOM', label: 'Custom', desc: 'Date range' },
                  { id: 'VISITOR', label: 'By Visitor', desc: 'Single guest' },
                ] as const
              ).map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => {
                    setReportType(tab.id);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`p-3 text-left rounded-xl border transition ${
                    reportType === tab.id
                      ? 'border-[#34526E] bg-[#EEF3F7] text-[#1E3A54]'
                      : 'border-[#E6ECF2] bg-white text-[#475569] hover:bg-[#F9FBFC]'
                  }`}
                >
                  <div className="font-semibold text-sm">{tab.label}</div>
                  <div className="text-[11px] text-[#6B7A8C] mt-0.5">{tab.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection: Excel or PDF */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1F2937] mb-2.5">
              File Format
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition ${
                  format === 'xlsx'
                    ? 'border-[#34526E] bg-[#EEF3F7] text-[#1E3A54]'
                    : 'border-[#E6ECF2] bg-white text-[#475569] hover:bg-[#F9FBFC]'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-[#34526E] flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Excel (.xlsx)</div>
                  <div className="text-[11px] text-[#6B7A8C]">Spreadsheet format</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition ${
                  format === 'pdf'
                    ? 'border-[#34526E] bg-[#EEF3F7] text-[#1E3A54]'
                    : 'border-[#E6ECF2] bg-white text-[#475569] hover:bg-[#F9FBFC]'
                }`}
              >
                <FileText className="w-5 h-5 text-[#34526E] flex-shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-sm">PDF (.pdf)</div>
                  <div className="text-[11px] text-[#6B7A8C]">Printable document</div>
                </div>
              </button>
            </div>
          </div>

          {/* Date / Visitor Inputs */}
          <div className="p-4 bg-[#F9FBFC] rounded-xl border border-[#E6ECF2] space-y-4">
            {(reportType === 'DAILY' || reportType === 'WEEKLY' || reportType === 'MONTHLY') && (
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-[#1F2937]">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2 bg-white border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
                  required
                />
              </div>
            )}

            {reportType === 'CUSTOM' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-[#1F2937]">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-[#1F2937]">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
                    required
                  />
                </div>
              </div>
            )}

            {reportType === 'VISITOR' && (
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-[#1F2937]">Visitor ID</label>
                <input
                  type="text"
                  placeholder="Enter Visitor ID"
                  value={visitorId}
                  onChange={(e) => setVisitorId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-[#1F2937]">Status Filter</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full sm:w-64 px-3.5 py-2 bg-white border border-[#DCE3EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#34526E]/20 focus:border-[#34526E]"
              >
                <option value="ALL">All Records</option>
                <option value="ACTIVE">Currently In Hub</option>
                <option value="CHECKED_OUT">Checked Out Only</option>
              </select>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200">
              {successMessage}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <Button type="submit" isLoading={downloading}>
              <Download className="w-4 h-4" />
              {downloading
                ? 'Generating...'
                : format === 'pdf'
                ? 'Download PDF (.pdf)'
                : 'Download Excel (.xlsx)'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
