import { ColumnMeta } from './columnTypeDetector';

export interface CleaningSummary {
  totalRows: number;
  cleanedRows: number;
  imputedCells: Record<string, number>;
  missingBeforeImputation: number;
}

export function cleanData(
  rows: Record<string, string>[],
  columns: ColumnMeta[]
): { cleaned: Record<string, unknown>[]; summary: CleaningSummary } {
  const imputedCells: Record<string, number> = {};
  let missingBeforeImputation = 0;

  // Count missing values before imputation
  for (const col of columns) {
    let missing = 0;
    for (const row of rows) {
      const val = row[col.name];
      if (val === undefined || val === null || val.trim() === '') missing++;
    }
    if (missing > 0) {
      imputedCells[col.name] = missing;
      missingBeforeImputation += missing;
    }
  }

  // Compute means for numeric columns
  const numericMeans: Record<string, number> = {};
  for (const col of columns) {
    if (col.type === 'numeric') {
      const vals = rows
        .map((r) => r[col.name])
        .filter((v) => v !== undefined && v !== null && v.trim() !== '')
        .map((v) => Number(v.replace(/,/g, '')))
        .filter((n) => !isNaN(n));
      numericMeans[col.name] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
  }

  const cleaned: Record<string, unknown>[] = rows.map((row) => {
    const newRow: Record<string, unknown> = {};
    for (const col of columns) {
      const raw = (row[col.name] ?? '').trim();
      if (raw === '') {
        if (col.type === 'numeric') {
          newRow[col.name] = numericMeans[col.name] ?? 0;
        } else if (col.type === 'categorical') {
          newRow[col.name] = 'N/A';
        } else {
          newRow[col.name] = null;
        }
      } else {
        if (col.type === 'numeric') {
          const n = Number(raw.replace(/,/g, ''));
          newRow[col.name] = isNaN(n) ? (numericMeans[col.name] ?? 0) : n;
        } else if (col.type === 'date') {
          newRow[col.name] = raw;
        } else {
          newRow[col.name] = raw;
        }
      }
    }
    return newRow;
  });

  return {
    cleaned,
    summary: {
      totalRows: rows.length,
      cleanedRows: cleaned.length,
      imputedCells,
      missingBeforeImputation,
    },
  };
}
