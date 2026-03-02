import { ColumnMeta } from './columnTypeDetector';
import { computeAllStats } from './statisticsEngine';
import { computeCorrelationMatrix } from './correlationEngine';
import { detectOutliers } from './outlierDetector';
import { selectChartConfig, prepareChartData } from './chartSelector';

// Use the same DataRow type as the store (Record<string, unknown>)
type DataRow = Record<string, unknown>;

export interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'histogram';
  data: DataRow[];
  xKey: string;
  yKey: string;
  title: string;
}

export interface CopilotResponse {
  text: string;
  chart?: ChartConfig;
}

// Stored model results for driver analysis
let _lastModelResult: {
  featureImportance: Array<{ column: string; coefficient: number; absCoefficient: number }>;
  targetColumn: string;
} | null = null;

export function setModelResultForCopilot(result: typeof _lastModelResult) {
  _lastModelResult = result;
}

function parseFilterQuery(
  query: string,
  rows: DataRow[],
  columns: ColumnMeta[]
): { filteredRows: DataRow[]; filterDesc: string } | null {
  const numericCols = columns.filter((c) => c.type === 'numeric').map((c) => c.name);

  const patterns = [
    { regex: /where\s+(\w[\w\s]*?)\s+(?:is\s+)?greater\s+than\s+([\d.]+)/i, op: '>' },
    { regex: /where\s+(\w[\w\s]*?)\s+(?:is\s+)?less\s+than\s+([\d.]+)/i, op: '<' },
    { regex: /where\s+(\w[\w\s]*?)\s+(?:is\s+)?(?:equal\s+to|equals?)\s+([\d.]+)/i, op: '==' },
    { regex: /where\s+(\w[\w\s]*?)\s+(?:is\s+)?above\s+([\d.]+)/i, op: '>' },
    { regex: /where\s+(\w[\w\s]*?)\s+(?:is\s+)?below\s+([\d.]+)/i, op: '<' },
    { regex: /(\w[\w\s]*?)\s+greater\s+than\s+([\d.]+)/i, op: '>' },
    { regex: /(\w[\w\s]*?)\s+less\s+than\s+([\d.]+)/i, op: '<' },
    { regex: /(\w[\w\s]*?)\s+above\s+([\d.]+)/i, op: '>' },
    { regex: /(\w[\w\s]*?)\s+below\s+([\d.]+)/i, op: '<' },
    { regex: /(\w[\w\s]*?)\s+(?:equal\s+to|equals?)\s+([\d.]+)/i, op: '==' },
  ];

  for (const { regex, op } of patterns) {
    const match = query.match(regex);
    if (match) {
      const colFragment = match[1].trim().toLowerCase();
      const threshold = parseFloat(match[2]);

      const col = numericCols.find(
        (c) =>
          c.toLowerCase().includes(colFragment) || colFragment.includes(c.toLowerCase())
      );
      if (!col || isNaN(threshold)) continue;

      const filteredRows = rows.filter((row) => {
        const val = Number(row[col]);
        if (isNaN(val)) return false;
        if (op === '>') return val > threshold;
        if (op === '<') return val < threshold;
        if (op === '==') return val === threshold;
        return false;
      });

      return {
        filteredRows,
        filterDesc: `${col} ${op === '==' ? '=' : op} ${threshold}`,
      };
    }
  }
  return null;
}

function parseComparisonQuery(
  query: string,
  rows: DataRow[],
  columns: ColumnMeta[]
): ChartConfig | null {
  const numericCols = columns.filter((c) => c.type === 'numeric');
  const categoricalCols = columns.filter((c) => c.type === 'categorical');

  const hasComparisonKeyword =
    /\b(compare|comparison|by|across|between|group\s+by|per|breakdown)\b/i.test(query);
  if (!hasComparisonKeyword) return null;

  let numericCol = numericCols.find((c) =>
    query.toLowerCase().includes(c.name.toLowerCase())
  );
  let groupCol = categoricalCols.find((c) =>
    query.toLowerCase().includes(c.name.toLowerCase())
  );

  if (!numericCol && numericCols.length > 0) numericCol = numericCols[0];
  if (!groupCol && categoricalCols.length > 0) groupCol = categoricalCols[0];

  if (!numericCol || !groupCol) return null;

  const groups: Record<string, { sum: number; count: number }> = {};
  rows.forEach((row) => {
    const groupVal = String(row[groupCol!.name] ?? 'Unknown');
    const numVal = Number(row[numericCol!.name]);
    if (isNaN(numVal)) return;
    if (!groups[groupVal]) groups[groupVal] = { sum: 0, count: 0 };
    groups[groupVal].sum += numVal;
    groups[groupVal].count++;
  });

  const chartData: DataRow[] = Object.entries(groups)
    .map(([key, { sum, count }]) => ({
      [groupCol!.name]: key,
      [numericCol!.name]: Math.round((sum / count) * 100) / 100,
    }))
    .sort(
      (a, b) =>
        (b[numericCol!.name] as number) - (a[numericCol!.name] as number)
    )
    .slice(0, 20);

  return {
    type: 'bar',
    data: chartData,
    xKey: groupCol.name,
    yKey: numericCol.name,
    title: `Average ${numericCol.name} by ${groupCol.name}`,
  };
}

function explainCorrelations(rows: DataRow[], columns: ColumnMeta[]): string {
  const numericCols = columns.filter((c) => c.type === 'numeric');
  if (numericCols.length < 2) {
    return 'Not enough numeric columns to compute correlations. Please upload a dataset with at least 2 numeric columns.';
  }

  const numericColNames = numericCols.map((c) => c.name);
  const matrix = computeCorrelationMatrix(rows, numericColNames);
  const pairs: Array<{ col1: string; col2: string; r: number }> = [];

  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const r = matrix[numericCols[i].name]?.[numericCols[j].name] ?? 0;
      pairs.push({ col1: numericCols[i].name, col2: numericCols[j].name, r });
    }
  }

  pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const top = pairs.slice(0, 3);

  if (top.length === 0) return 'No correlations found in the dataset.';

  const descriptions = top.map(({ col1, col2, r }) => {
    const absR = Math.abs(r);
    const strength = absR >= 0.7 ? 'strongly' : absR >= 0.4 ? 'moderately' : 'weakly';
    const direction = r >= 0 ? 'positively' : 'negatively';
    const rStr = r.toFixed(3);

    let businessNote = '';
    if (absR >= 0.7) {
      businessNote =
        r >= 0
          ? ` This suggests that increases in ${col1} are consistently associated with increases in ${col2}.`
          : ` This suggests that increases in ${col1} are consistently associated with decreases in ${col2}.`;
    } else if (absR >= 0.4) {
      businessNote = ` There is a notable relationship between these variables worth investigating further.`;
    }

    return `**${col1}** and **${col2}** are ${strength} ${direction} correlated (r = ${rStr}).${businessNote}`;
  });

  return `Here are the top correlations in your dataset:\n\n${descriptions.join('\n\n')}`;
}

function explainDrivers(query: string, rows: DataRow[], columns: ColumnMeta[]): string {
  const numericCols = columns.filter((c) => c.type === 'numeric');

  let targetCol = columns.find((c) =>
    query.toLowerCase().includes(c.name.toLowerCase())
  )?.name;

  if (_lastModelResult) {
    const modelTarget = _lastModelResult.targetColumn;
    if (!targetCol || targetCol === modelTarget) {
      const top5 = _lastModelResult.featureImportance.slice(0, 5);
      if (top5.length > 0) {
        const lines = top5.map((f, i) => {
          const direction = f.coefficient >= 0 ? 'positively' : 'negatively';
          return `${i + 1}. **${f.column}** — ${direction} influences ${modelTarget} (coefficient: ${f.coefficient.toFixed(4)})`;
        });
        return `Based on the trained model, the top drivers of **${modelTarget}** are:\n\n${lines.join('\n')}\n\nThese are ranked by absolute coefficient magnitude from the trained model.`;
      }
    }
  }

  if (!targetCol) {
    targetCol = numericCols[0]?.name;
  }

  if (!targetCol || numericCols.length < 2) {
    return 'Please specify a target variable or train a model first to get driver analysis.';
  }

  const numericColNames = numericCols.map((c) => c.name);
  const matrix = computeCorrelationMatrix(rows, numericColNames);
  const otherCols = numericCols.filter((c) => c.name !== targetCol);

  const drivers = otherCols
    .map((col) => ({
      column: col.name,
      r:
        matrix[targetCol!]?.[col.name] ??
        matrix[col.name]?.[targetCol!] ??
        0,
    }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 5);

  if (drivers.length === 0)
    return `No numeric columns found to analyze drivers of ${targetCol}.`;

  const lines = drivers.map((d, i) => {
    const absR = Math.abs(d.r);
    const strength = absR >= 0.7 ? 'strong' : absR >= 0.4 ? 'moderate' : 'weak';
    const direction = d.r >= 0 ? 'positive' : 'negative';
    return `${i + 1}. **${d.column}** — ${strength} ${direction} correlation (r = ${d.r.toFixed(3)})`;
  });

  return (
    `Top drivers of **${targetCol}** (based on correlation analysis):\n\n${lines.join('\n')}\n\n` +
    `*Tip: Train a predictive model for more precise feature importance rankings.*`
  );
}

// Helper: build a ChartConfig from rows using the new chartSelector API
function buildChartConfig(
  rows: DataRow[],
  columns: ColumnMeta[],
  preferredType: 'bar' | 'line' | 'scatter' | 'pie' | 'histogram',
  xCol: string,
  yCol: string,
  title: string
): ChartConfig {
  const config = selectChartConfig(columns, preferredType, xCol, yCol);
  // Override with explicit columns
  config.xColumn = xCol;
  config.yColumn = yCol;
  config.chartType = preferredType;

  const narrowRows = rows as Record<string, string | number | null>[];
  const prepared = prepareChartData(narrowRows, columns, config);

  return {
    type: preferredType,
    data: prepared.data as DataRow[],
    xKey: prepared.xKey,
    yKey: prepared.yKey,
    title,
  };
}

export function processQuery(
  query: string,
  rows: DataRow[],
  columns: ColumnMeta[]
): CopilotResponse {
  if (!rows || rows.length === 0) {
    return { text: 'Please upload a dataset first to start analyzing.' };
  }

  const q = query.toLowerCase().trim();
  const numericCols = columns.filter((c) => c.type === 'numeric');
  const categoricalCols = columns.filter((c) => c.type === 'categorical');
  const numericColNames = numericCols.map((c) => c.name);

  // 1. Driver / predictor analysis
  if (
    /\b(drives?|predicts?|influences?|causes?|affects?|impact\s+on|top\s+drivers?|what\s+drives|what\s+predicts|key\s+factors?)\b/i.test(
      q
    )
  ) {
    return { text: explainDrivers(query, rows, columns) };
  }

  // 2. Correlation explanation
  if (
    /\b(correlated?|correlation|relationship|associated|related\s+to|association)\b/i.test(q)
  ) {
    return { text: explainCorrelations(rows, columns) };
  }

  // 3. Filter + chart
  const filterResult = parseFilterQuery(query, rows, columns);
  if (filterResult) {
    const { filteredRows, filterDesc } = filterResult;
    if (filteredRows.length === 0) {
      return {
        text: `No rows found where ${filterDesc}. Try a different threshold.`,
      };
    }

    const xCol = categoricalCols[0]?.name || numericCols[0]?.name;
    const yCol = numericCols[0]?.name;

    if (xCol && yCol) {
      const chartType: 'bar' | 'histogram' =
        categoricalCols.length > 0 ? 'bar' : 'histogram';
      const chart = buildChartConfig(
        filteredRows,
        columns,
        chartType,
        xCol,
        yCol,
        `Filtered: ${filterDesc}`
      );
      return {
        text: `Found **${filteredRows.length}** rows where ${filterDesc}. Here's the chart for the filtered data:`,
        chart,
      };
    }

    return {
      text: `Found **${filteredRows.length}** rows where ${filterDesc} out of ${rows.length} total rows.`,
    };
  }

  // 4. Comparison chart
  const comparisonChart = parseComparisonQuery(query, rows, columns);
  if (comparisonChart) {
    const uniqueGroups = [
      ...new Set(rows.map((r) => String(r[comparisonChart.xKey] ?? ''))),
    ].filter(Boolean).length;
    return {
      text: `Here's the comparison of **${comparisonChart.yKey}** across **${comparisonChart.xKey}** (${uniqueGroups} groups, showing average values):`,
      chart: comparisonChart,
    };
  }

  // 5. Statistics query
  if (
    /\b(statistics?|stats?|summary|describe|mean|average|median|std|standard\s+deviation|variance|min|max)\b/i.test(
      q
    )
  ) {
    if (numericColNames.length === 0) {
      return { text: 'No numeric columns found in the dataset.' };
    }
    const stats = computeAllStats(rows, numericColNames);
    const col =
      numericCols.find((c) => q.includes(c.name.toLowerCase())) || numericCols[0];
    const s = stats[col.name];
    if (!s) return { text: `Could not compute statistics for ${col.name}.` };

    return {
      text:
        `**Statistics for ${col.name}:**\n\n` +
        `- Mean: ${s.mean.toFixed(4)}\n` +
        `- Median: ${s.median.toFixed(4)}\n` +
        `- Std Dev: ${s.stdDev.toFixed(4)}\n` +
        `- Min: ${s.min.toFixed(4)}\n` +
        `- Max: ${s.max.toFixed(4)}\n` +
        `- Count: ${s.count}\n` +
        `- Missing: ${s.nullCount}`,
    };
  }

  // 6. Outlier query
  if (
    /\b(outliers?|anomalies|anomalous|unusual|extreme\s+values?)\b/i.test(q)
  ) {
    if (numericColNames.length === 0) {
      return { text: 'No numeric columns found to detect outliers.' };
    }
    const outliers = detectOutliers(rows, numericColNames);
    const withOutliers = outliers.filter((o) => o.outlierCount > 0);
    if (withOutliers.length === 0) {
      return {
        text: 'No significant outliers detected in the dataset using the IQR method.',
      };
    }
    const lines = withOutliers
      .sort((a, b) => b.outlierCount - a.outlierCount)
      .slice(0, 5)
      .map(
        (o) =>
          `- **${o.column}**: ${o.outlierCount} outliers (bounds: [${o.lowerBound.toFixed(2)}, ${o.upperBound.toFixed(2)}])`
      );
    return {
      text:
        `**Outlier Summary:**\n\n${lines.join('\n')}\n\n` +
        `Outliers detected using the IQR method (values outside Q1 - 1.5×IQR and Q3 + 1.5×IQR).`,
    };
  }

  // 7. Trend query
  if (
    /\b(trend|over\s+time|time\s+series|growth|decline|increase|decrease|change)\b/i.test(q)
  ) {
    const dateCols = columns.filter((c) => c.type === 'date');
    const numCol =
      numericCols.find((c) => q.includes(c.name.toLowerCase())) || numericCols[0];

    if (dateCols.length > 0 && numCol) {
      const dateCol = dateCols[0];
      const chart = buildChartConfig(
        rows,
        columns,
        'line',
        dateCol.name,
        numCol.name,
        `${numCol.name} over time`
      );
      return {
        text: `Here's the trend of **${numCol.name}** over time:`,
        chart,
      };
    }

    if (numCol) {
      return {
        text: `**${numCol.name}** trend analysis: The column has ${rows.length} data points. Upload data with a date column for time-series trend visualization.`,
      };
    }
  }

  // 8. Distribution / chart query
  if (
    /\b(distribution|histogram|chart|plot|visualize|show|display|graph)\b/i.test(q)
  ) {
    const numCol =
      numericCols.find((c) => q.includes(c.name.toLowerCase())) || numericCols[0];
    const catCol =
      categoricalCols.find((c) => q.includes(c.name.toLowerCase())) ||
      categoricalCols[0];

    if (numCol) {
      const xCol = catCol?.name || numCol.name;
      const chartType: 'bar' | 'histogram' = catCol ? 'bar' : 'histogram';
      const chart = buildChartConfig(
        rows,
        columns,
        chartType,
        xCol,
        numCol.name,
        `Distribution of ${numCol.name}`
      );
      return {
        text: `Here's the ${chartType === 'histogram' ? 'distribution' : 'chart'} of **${numCol.name}**:`,
        chart,
      };
    }
  }

  // 9. General dataset info
  if (
    /\b(dataset|data|rows?|columns?|fields?|overview|summary|info|about)\b/i.test(q)
  ) {
    return {
      text:
        `**Dataset Overview:**\n\n` +
        `- **Rows:** ${rows.length.toLocaleString()}\n` +
        `- **Columns:** ${columns.length}\n` +
        `- **Numeric columns:** ${numericCols.map((c) => c.name).join(', ') || 'none'}\n` +
        `- **Categorical columns:** ${categoricalCols.map((c) => c.name).join(', ') || 'none'}\n` +
        `- **Date columns:** ${columns.filter((c) => c.type === 'date').map((c) => c.name).join(', ') || 'none'}`,
    };
  }

  // 10. Default: try to generate a chart for any mentioned column
  const mentionedNumCol = numericCols.find((c) =>
    q.includes(c.name.toLowerCase())
  );
  const mentionedCatCol = categoricalCols.find((c) =>
    q.includes(c.name.toLowerCase())
  );

  if (mentionedNumCol || mentionedCatCol) {
    const xCol =
      mentionedCatCol?.name || mentionedNumCol?.name || columns[0]?.name;
    const yCol = mentionedNumCol?.name || numericCols[0]?.name;
    if (xCol && yCol) {
      const autoConfig = selectChartConfig(columns);
      const chartType = autoConfig.chartType;
      const chart = buildChartConfig(
        rows,
        columns,
        chartType,
        xCol,
        yCol,
        `${yCol}${mentionedCatCol ? ` by ${xCol}` : ''}`
      );
      return {
        text: `Here's a visualization of **${yCol}**${mentionedCatCol ? ` by **${xCol}**` : ''}:`,
        chart,
      };
    }
  }

  // Fallback
  return {
    text:
      `I can help you analyze your dataset. Try asking:\n\n` +
      `- "Show distribution of [column]"\n` +
      `- "Compare [metric] by [category]"\n` +
      `- "Where [column] is greater than [value]"\n` +
      `- "What drives [column]?"\n` +
      `- "Show correlations"\n` +
      `- "Show outliers"\n` +
      `- "Dataset overview"\n\n` +
      `Available columns: ${columns.map((c) => c.name).join(', ')}`,
  };
}
