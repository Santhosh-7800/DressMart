import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/** jspdf-autotable (v5) still attaches `lastAutoTable` to the doc instance at runtime for stacking
 *  multiple tables — it's just no longer part of its public .d.ts, so this is the documented shape,
 *  narrowly typed rather than reaching for `any`. */
type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface ReportExportInput {
  filenamePrefix: string;
  reportTitle: string;
  /** Rendered as a "Key: Value" summary block above the table(s) — e.g. date range, total revenue. */
  summary: { label: string; value: string }[];
  tables: ReportTable[];
}

function timestampSuffix(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Dependency-free CSV — escapes commas/quotes/newlines the same way the existing invoice.ts's
 *  plain-text download already establishes as this app's Blob-download convention. Exports only the
 *  first table (CSV has no concept of a summary block or multiple sheets). */
export function exportReportToCsv(input: ReportExportInput): void {
  const table = input.tables[0];
  if (!table) return;
  const escape = (cell: string | number) => {
    const s = String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.headers.map(escape).join(','), ...table.rows.map((row) => row.map(escape).join(','))];
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${input.filenamePrefix}-${timestampSuffix()}.csv`);
}

/** One sheet per table, using the SheetJS (`xlsx`) library. */
export function exportReportToExcel(input: ReportExportInput): void {
  const workbook = XLSX.utils.book_new();
  input.tables.forEach((table, i) => {
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, table.title.slice(0, 31) || `Sheet${i + 1}`);
  });
  XLSX.writeFile(workbook, `${input.filenamePrefix}-${timestampSuffix()}.xlsx`);
}

/** jsPDF's built-in fonts (helvetica/times/courier) have no glyph for ₹ (U+20B9) — it silently
 *  renders as a mangled superscript-1. CSV/Excel don't have this problem (real Unicode text), so
 *  this substitution is PDF-only rather than changing formatCurrency itself. */
function pdfSafeText(value: string | number): string {
  return String(value).replace(/₹/g, 'Rs. ');
}

/** One PDF with a title, a summary block, and one auto-laid-out table per ReportTable. */
export function exportReportToPdf(input: ReportExportInput): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(input.reportTitle, 14, 18);

  let cursorY = 28;
  if (input.summary.length > 0) {
    doc.setFontSize(10);
    input.summary.forEach((row) => {
      doc.text(pdfSafeText(`${row.label}: ${row.value}`), 14, cursorY);
      cursorY += 6;
    });
    cursorY += 4;
  }

  input.tables.forEach((table) => {
    doc.setFontSize(12);
    doc.text(table.title, 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 4,
      head: [table.headers],
      body: table.rows.map((row) => row.map((cell) => pdfSafeText(cell))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [255, 153, 0] },
    });
    cursorY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? cursorY + 40;
    cursorY += 12;
  });

  doc.save(`${input.filenamePrefix}-${timestampSuffix()}.pdf`);
}
