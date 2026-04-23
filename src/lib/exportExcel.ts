import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export interface ExcelExportOptions {
  sheetName: string;
  columns: { header: string; dataKey: string; width?: number }[];
  rows: Record<string, string | number>[];
  /** Example: 'WASA_Complaints_Report' — date suffix + .xlsx is appended. */
  filenamePrefix: string;
}

export const exportToExcel = (opts: ExcelExportOptions): void => {
  const ws = XLSX.utils.json_to_sheet(
    opts.rows.map((r) => {
      const obj: Record<string, string | number> = {};
      opts.columns.forEach((c) => {
        obj[c.header] = r[c.dataKey] ?? '';
      });
      return obj;
    }),
  );
  ws['!cols'] = opts.columns.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName.substring(0, 31));

  const filename = `${opts.filenamePrefix}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, filename);
};
