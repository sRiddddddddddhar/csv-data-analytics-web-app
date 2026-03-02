export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

export function computeCorrelationMatrix(
  data: Record<string, unknown>[],
  numericCols: string[]
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};

  const colVectors: Record<string, number[]> = {};
  for (const col of numericCols) {
    colVectors[col] = data.map((row) => {
      const v = row[col];
      return typeof v === 'number' ? v : Number(v);
    }).filter((n) => !isNaN(n));
  }

  for (const colA of numericCols) {
    matrix[colA] = {};
    for (const colB of numericCols) {
      if (colA === colB) {
        matrix[colA][colB] = 1;
      } else {
        // Align vectors by index
        const vecA: number[] = [];
        const vecB: number[] = [];
        for (let i = 0; i < data.length; i++) {
          const a = data[i][colA];
          const b = data[i][colB];
          const na = typeof a === 'number' ? a : Number(a);
          const nb = typeof b === 'number' ? b : Number(b);
          if (!isNaN(na) && !isNaN(nb)) {
            vecA.push(na);
            vecB.push(nb);
          }
        }
        matrix[colA][colB] = pearsonCorrelation(vecA, vecB);
      }
    }
  }

  return matrix;
}
