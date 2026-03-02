export interface ColumnStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  variance: number;
  count: number;
  nullCount: number;
}

export function computeStatistics(values: (number | null | undefined)[]): ColumnStats {
  const valid = values.filter((v) => v !== null && v !== undefined && !isNaN(v as number)) as number[];
  const nullCount = values.length - valid.length;
  const count = valid.length;

  if (count === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0, variance: 0, count: 0, nullCount };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = valid.reduce((s, v) => s + v, 0) / count;

  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return { mean, median, min, max, stdDev, variance, count, nullCount };
}

export function computeAllStats(
  data: Record<string, unknown>[],
  numericColumns: string[]
): Record<string, ColumnStats> {
  const result: Record<string, ColumnStats> = {};
  for (const col of numericColumns) {
    const values = data.map((row) => {
      const v = row[col];
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    });
    result[col] = computeStatistics(values);
  }
  return result;
}
