import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  columns: { header: string; dataKey: string }[];
  rows: Record<string, string | number>[];
  filename: string;
  summary?: { label: string; value: string | number }[];
  orientation?: 'portrait' | 'landscape';
}

export const exportToPdf = (opts: PdfExportOptions): void => {
  const doc = new jsPDF({
    orientation: opts.orientation ?? 'landscape',
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235); // brand-600
  doc.text(opts.title, 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${format(new Date(), 'PPpp')}`, 40, 58);

  if (opts.subtitle) {
    doc.setTextColor(70);
    doc.text(opts.subtitle, 40, 74);
  }

  if (opts.summary?.length) {
    const summaryText = opts.summary.map((s) => `${s.label}: ${s.value}`).join('   •   ');
    doc.setTextColor(60);
    doc.setFontSize(9);
    doc.text(summaryText, 40, 90);
  }

  autoTable(doc, {
    startY: opts.summary?.length ? 100 : 86,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => String(r[c.dataKey] ?? ''))),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      const current = data.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Page ${current} of ${pageCount}`,
        pageWidth - 80,
        doc.internal.pageSize.getHeight() - 20,
      );
    },
  });

  doc.save(opts.filename);
};
