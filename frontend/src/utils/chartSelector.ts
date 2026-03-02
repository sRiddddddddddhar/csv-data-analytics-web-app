import type { ColumnMeta } from './columnTypeDetector';

// Local alias to avoid broken re-export chain
type DataRow = Record<string, string | number | null>;

export interface ChartConfig {
  chartType: 'bar' | 'line' | 'scatter' | 'pie' | 'histogram';
  xColumn: string;
  yColumn: string;
}

export interface PreparedChartData {
  chartType: ChartConfig['chartType'];
  data: DataRow[];
  xKey: string;
  yKey: string;
}

function isNumeric(val: string | number | null): boolean {
  if (val === null || val === '') return false;
  return !isNaN(Number(val));
}

export function selectChartConfig(
  columns: ColumnMeta[],
  preferredChartType?: string,
  preferredX?: string,
  preferredY?: string
): ChartConfig {
  const numericCols = columns.filter((c) => c.type === 'numeric');
  const categoricalCols = columns.filter((c) => c.type === 'categorical');
  const dateCols = columns.filter((c) => c.type === 'date');

  let chartType: ChartConfig['chartType'] = 'bar';
  let xColumn = columns[0]?.name ?? '';
  let yColumn = columns[1]?.name ?? columns[0]?.name ?? '';

  // Determine chart type
  if (preferredChartType && ['bar', 'line', 'scatter', 'pie', 'histogram'].includes(preferredChartType)) {
    chartType = preferredChartType as ChartConfig['chartType'];
  } else if (dateCols.length > 0 && numericCols.length > 0) {
    chartType = 'line';
  } else if (numericCols.length >= 2) {
    chartType = 'scatter';
  } else if (categoricalCols.length > 0 && numericCols.length > 0) {
    chartType = 'bar';
  } else if (numericCols.length === 1) {
    chartType = 'histogram';
  }

  // Determine X column
  if (preferredX && columns.some((c) => c.name === preferredX)) {
    xColumn = preferredX;
  } else if (dateCols.length > 0) {
    xColumn = dateCols[0].name;
  } else if (categoricalCols.length > 0) {
    xColumn = categoricalCols[0].name;
  } else if (numericCols.length > 0) {
    xColumn = numericCols[0].name;
  }

  // Determine Y column
  if (preferredY && columns.some((c) => c.name === preferredY)) {
    yColumn = preferredY;
  } else if (numericCols.length > 0) {
    yColumn = numericCols[0].name === xColumn && numericCols.length > 1
      ? numericCols[1].name
      : numericCols[0].name;
  } else if (columns.length > 1) {
    yColumn = columns.find((c) => c.name !== xColumn)?.name ?? columns[0].name;
  }

  return { chartType, xColumn, yColumn };
}

export function prepareChartData(
  rows: DataRow[],
  columns: ColumnMeta[],
  config: ChartConfig
): PreparedChartData {
  const { chartType, xColumn, yColumn } = config;

  if (!rows.length || !xColumn || !yColumn) {
    return { chartType, data: [], xKey: xColumn, yKey: yColumn };
  }

  const MAX_POINTS = 200;

  if (chartType === 'histogram') {
    const col = xColumn;
    const values = rows
      .map((r) => Number(r[col]))
      .filter((v) => !isNaN(v));

    if (values.length === 0) {
      return { chartType, data: [], xKey: 'bin', yKey: 'count' };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length)));
    const binSize = (max - min) / binCount || 1;

    const bins: DataRow[] = Array.from({ length: binCount }, (_, i) => ({
      bin: `${(min + i * binSize).toFixed(1)}–${(min + (i + 1) * binSize).toFixed(1)}`,
      count: 0,
    }));

    values.forEach((v) => {
      const idx = Math.min(Math.floor((v - min) / binSize), binCount - 1);
      (bins[idx].count as number)++;
    });

    return { chartType: 'bar', data: bins, xKey: 'bin', yKey: 'count' };
  }

  if (chartType === 'pie') {
    const grouped: Record<string, number> = {};
    rows.forEach((r) => {
      const key = String(r[xColumn] ?? 'Unknown');
      const val = isNumeric(r[yColumn]) ? Number(r[yColumn]) : 1;
      grouped[key] = (grouped[key] ?? 0) + val;
    });

    const data = Object.entries(grouped)
      .slice(0, 20)
      .map(([name, value]) => ({ name, value }));

    return { chartType: 'pie', data, xKey: 'name', yKey: 'value' };
  }

  if (chartType === 'scatter') {
    const data = rows
      .filter((r) => isNumeric(r[xColumn]) && isNumeric(r[yColumn]))
      .slice(0, MAX_POINTS)
      .map((r) => ({
        [xColumn]: Number(r[xColumn]),
        [yColumn]: Number(r[yColumn]),
      }));

    return { chartType: 'scatter', data, xKey: xColumn, yKey: yColumn };
  }

  // bar / line
  const isXNumeric = columns.find((c) => c.name === xColumn)?.type === 'numeric';

  if (isXNumeric) {
    // aggregate by rounding x to reduce points
    const data = rows
      .filter((r) => isNumeric(r[xColumn]) && isNumeric(r[yColumn]))
      .slice(0, MAX_POINTS)
      .map((r) => ({
        [xColumn]: Number(r[xColumn]),
        [yColumn]: Number(r[yColumn]),
      }));
    return { chartType, data, xKey: xColumn, yKey: yColumn };
  }

  // categorical X: aggregate by category
  const grouped: Record<string, { sum: number; count: number }> = {};
  rows.forEach((r) => {
    const key = String(r[xColumn] ?? 'Unknown');
    const val = isNumeric(r[yColumn]) ? Number(r[yColumn]) : 0;
    if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
    grouped[key].sum += val;
    grouped[key].count += 1;
  });

  const data = Object.entries(grouped)
    .slice(0, MAX_POINTS)
    .map(([key, { sum, count }]) => ({
      [xColumn]: key,
      [yColumn]: count > 0 ? parseFloat((sum / count).toFixed(4)) : 0,
    }));

  return { chartType, data, xKey: xColumn, yKey: yColumn };
}
