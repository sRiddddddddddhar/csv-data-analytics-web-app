export interface OutlierResult {
  column: string;
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
  outlierCount: number;
  outlierValues: number[];
}

export function detectOutliers(
  data: Record<string, unknown>[],
  numericCols: string[]
): OutlierResult[] {
  return numericCols.map((col) => {
    const values = data
      .map((row) => {
        const v = row[col];
        return typeof v === 'number' ? v : Number(v);
      })
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);

    if (values.length < 4) {
      return {
        column: col,
        q1: 0,
        q3: 0,
        iqr: 0,
        lowerBound: 0,
        upperBound: 0,
        outlierCount: 0,
        outlierValues: [],
      };
    }

    const q1Idx = Math.floor(values.length * 0.25);
    const q3Idx = Math.floor(values.length * 0.75);
    const q1 = values[q1Idx];
    const q3 = values[q3Idx];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outlierValues = values.filter((v) => v < lowerBound || v > upperBound);

    return {
      column: col,
      q1,
      q3,
      iqr,
      lowerBound,
      upperBound,
      outlierCount: outlierValues.length,
      outlierValues: outlierValues.slice(0, 5),
    };
  });
}
