export interface TrendResult {
  column: string;
  slope: number;
  direction: 'rising' | 'falling' | 'flat';
  rSquared: number;
}

export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - meanX) * (y[i] - meanY);
    ssXX += (x[i] - meanX) ** 2;
    ssYY += (y[i] - meanY) ** 2;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const rSquared = ssYY === 0 ? 0 : (ssXY ** 2) / (ssXX * ssYY);

  return { slope, intercept, rSquared };
}

export function detectTrends(
  data: Record<string, unknown>[],
  dateCol: string,
  numericCols: string[]
): TrendResult[] {
  const dateValues = data.map((row) => {
    const v = row[dateCol];
    return new Date(v as string).getTime();
  }).filter((t) => !isNaN(t));

  if (dateValues.length < 2) return [];

  const minT = Math.min(...dateValues);
  const maxT = Math.max(...dateValues);
  const range = maxT - minT || 1;
  const normalizedDates = dateValues.map((t) => (t - minT) / range);

  return numericCols.map((col) => {
    const pairs: [number, number][] = [];
    for (let i = 0; i < data.length; i++) {
      const t = new Date(data[i][dateCol] as string).getTime();
      const v = data[i][col];
      const n = typeof v === 'number' ? v : Number(v);
      if (!isNaN(t) && !isNaN(n)) {
        const normT = (t - minT) / range;
        pairs.push([normT, n]);
      }
    }

    if (pairs.length < 2) return { column: col, slope: 0, direction: 'flat' as const, rSquared: 0 };

    const { slope, rSquared } = linearRegression(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
    const threshold = Math.abs(meanY) * 0.01;

    const direction: 'rising' | 'falling' | 'flat' =
      slope > threshold ? 'rising' : slope < -threshold ? 'falling' : 'flat';

    return { column: col, slope, direction, rSquared };
  });
}
