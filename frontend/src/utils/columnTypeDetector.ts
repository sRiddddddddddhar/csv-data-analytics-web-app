export type ColumnType = 'numeric' | 'categorical' | 'date';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^\d{2}-\d{2}-\d{4}$/,
  /^\d{4}\/\d{2}\/\d{2}$/,
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
];

function isDateValue(val: string): boolean {
  if (!val) return false;
  for (const p of DATE_PATTERNS) {
    if (p.test(val.trim())) return true;
  }
  const d = new Date(val);
  return !isNaN(d.getTime()) && val.length > 4;
}

function isNumericValue(val: string): boolean {
  if (!val || val.trim() === '') return false;
  return !isNaN(Number(val.replace(/,/g, '')));
}

export function detectColumnTypes(
  rows: Record<string, string>[],
  headers: string[]
): ColumnMeta[] {
  return headers.map((col) => {
    const sample = rows
      .map((r) => (r[col] ?? '').trim())
      .filter((v) => v !== '')
      .slice(0, 100);

    if (sample.length === 0) return { name: col, type: 'categorical' as ColumnType };

    const dateCount = sample.filter(isDateValue).length;
    const numCount = sample.filter(isNumericValue).length;

    if (dateCount / sample.length > 0.7) return { name: col, type: 'date' as ColumnType };
    if (numCount / sample.length > 0.7) return { name: col, type: 'numeric' as ColumnType };
    return { name: col, type: 'categorical' as ColumnType };
  });
}
