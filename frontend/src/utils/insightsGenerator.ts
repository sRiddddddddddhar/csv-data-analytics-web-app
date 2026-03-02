import { ColumnMeta } from './columnTypeDetector';
import { computeCorrelationMatrix } from './correlationEngine';
import { detectOutliers } from './outlierDetector';
import { detectTrends } from './regressionEngine';
import { CleaningSummary } from './dataCleanser';

export interface Insight {
  id: string;
  category: 'correlation' | 'outlier' | 'trend' | 'category' | 'missing' | 'general';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success';
}

export function generateInsights(
  data: Record<string, unknown>[],
  columns: ColumnMeta[],
  cleaningSummary?: CleaningSummary
): Insight[] {
  const insights: Insight[] = [];
  if (!data || data.length === 0 || !columns || columns.length === 0) return insights;

  const numericCols = columns.filter((c) => c.type === 'numeric').map((c) => c.name);
  const categoricalCols = columns.filter((c) => c.type === 'categorical').map((c) => c.name);
  const dateCols = columns.filter((c) => c.type === 'date').map((c) => c.name);

  // General dataset info
  insights.push({
    id: 'general-size',
    category: 'general',
    title: 'Dataset Overview',
    description: `Dataset contains ${data.length} rows and ${columns.length} columns (${numericCols.length} numeric, ${categoricalCols.length} categorical, ${dateCols.length} date).`,
    severity: 'info',
  });

  // Correlation analysis
  if (numericCols.length >= 2) {
    try {
      const matrix = computeCorrelationMatrix(data, numericCols);
      let maxCorr = 0;
      let pairA = '';
      let pairB = '';
      for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
          const corr = Math.abs(matrix[numericCols[i]]?.[numericCols[j]] ?? 0);
          if (corr > maxCorr) {
            maxCorr = corr;
            pairA = numericCols[i];
            pairB = numericCols[j];
          }
        }
      }
      if (pairA && pairB) {
        const strength = maxCorr > 0.8 ? 'strong' : maxCorr > 0.5 ? 'moderate' : 'weak';
        insights.push({
          id: 'correlation-top',
          category: 'correlation',
          title: 'Strongest Correlation',
          description: `"${pairA}" and "${pairB}" have a ${strength} correlation (r = ${maxCorr.toFixed(3)}).`,
          severity: maxCorr > 0.8 ? 'warning' : 'info',
        });
      }
    } catch (_) {}
  }

  // Outlier analysis
  if (numericCols.length > 0) {
    try {
      const outliers = detectOutliers(data, numericCols);
      const champion = outliers.reduce(
        (best, cur) => (cur.outlierCount > best.outlierCount ? cur : best),
        outliers[0]
      );
      if (champion && champion.outlierCount > 0) {
        insights.push({
          id: 'outlier-champion',
          category: 'outlier',
          title: 'Most Outliers Detected',
          description: `Column "${champion.column}" has the most outliers: ${champion.outlierCount} values outside [${champion.lowerBound.toFixed(2)}, ${champion.upperBound.toFixed(2)}].`,
          severity: 'warning',
        });
      }
    } catch (_) {}
  }

  // Trend analysis
  if (dateCols.length > 0 && numericCols.length > 0) {
    try {
      const trends = detectTrends(data, dateCols[0], numericCols);
      for (const trend of trends) {
        const emoji = trend.direction === 'rising' ? '📈' : trend.direction === 'falling' ? '📉' : '➡️';
        insights.push({
          id: `trend-${trend.column}`,
          category: 'trend',
          title: `Trend: ${trend.column}`,
          description: `${emoji} "${trend.column}" shows a ${trend.direction} trend over time (R² = ${trend.rSquared.toFixed(3)}).`,
          severity: trend.direction === 'flat' ? 'info' : 'success',
        });
      }
    } catch (_) {}
  }

  // Dominant category
  if (categoricalCols.length > 0) {
    try {
      for (const col of categoricalCols.slice(0, 2)) {
        const freq: Record<string, number> = {};
        for (const row of data) {
          const v = String(row[col] ?? 'N/A');
          freq[v] = (freq[v] ?? 0) + 1;
        }
        const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        if (entries.length > 0) {
          const [topVal, topCount] = entries[0];
          const pct = ((topCount / data.length) * 100).toFixed(1);
          insights.push({
            id: `category-dominant-${col}`,
            category: 'category',
            title: `Dominant Category in "${col}"`,
            description: `"${topVal}" is the most frequent value in "${col}" (${topCount} occurrences, ${pct}% of rows).`,
            severity: 'info',
          });
        }
      }
    } catch (_) {}
  }

  // Missing values
  if (cleaningSummary && cleaningSummary.missingBeforeImputation > 0) {
    const highMissingCols = Object.entries(cleaningSummary.imputedCells)
      .filter(([, count]) => count / cleaningSummary.totalRows > 0.05)
      .map(([col, count]) => `"${col}" (${((count / cleaningSummary.totalRows) * 100).toFixed(1)}%)`);

    if (highMissingCols.length > 0) {
      insights.push({
        id: 'missing-values',
        category: 'missing',
        title: 'High Missing Value Columns',
        description: `Columns with >5% missing values: ${highMissingCols.join(', ')}. Values were imputed automatically.`,
        severity: 'warning',
      });
    }
  }

  return insights;
}
