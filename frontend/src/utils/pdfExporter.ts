import { useDataStore } from '../store/dataStore';
import { computeAllStats } from './statisticsEngine';
import { detectOutliers } from './outlierDetector';
import { computeCorrelationMatrix } from './correlationEngine';
import { generateInsights } from './insightsGenerator';
import { selectChartConfig, prepareChartData } from './chartSelector';
import type { PreparedChartData } from './chartSelector';

type DataRow = Record<string, string | number | null>;

// ─── Inline SVG chart generator ─────────────────────────────────────────────

const CHART_WIDTH = 760;
const CHART_HEIGHT = 300;
const PADDING = { top: 30, right: 30, bottom: 60, left: 70 };
const PLOT_W = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#4f46e5', '#7c3aed', '#9333ea'];

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateBarChartSvg(prepared: PreparedChartData): string {
  const { data, xKey, yKey } = prepared;
  if (!data.length) return '';

  const values = data.map(d => Number(d[yKey]) || 0);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const barW = Math.max(4, Math.min(50, PLOT_W / data.length - 4));
  const step = PLOT_W / data.length;

  // Y axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = minVal + (range * i) / tickCount;
    const y = PADDING.top + PLOT_H - ((val - minVal) / range) * PLOT_H;
    return { val, y };
  });

  const bars = data.map((d, i) => {
    const val = Number(d[yKey]) || 0;
    const barH = Math.max(0, ((val - minVal) / range) * PLOT_H);
    const x = PADDING.left + i * step + (step - barW) / 2;
    const y = PADDING.top + PLOT_H - barH;
    const label = String(d[xKey] ?? '').slice(0, 10);
    const showLabel = data.length <= 30;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${barH.toFixed(1)}"
            fill="${COLORS[0]}" rx="3" opacity="0.9"/>
      ${showLabel ? `<text x="${(x + barW / 2).toFixed(1)}" y="${(PADDING.top + PLOT_H + 16).toFixed(1)}"
            text-anchor="middle" font-size="9" fill="#64748b"
            transform="rotate(-35,${(x + barW / 2).toFixed(1)},${(PADDING.top + PLOT_H + 16).toFixed(1)})"
            >${escapeXml(label)}</text>` : ''}
    `;
  }).join('');

  const yAxisLines = yTicks.map(({ val, y }) => `
    <line x1="${PADDING.left}" y1="${y.toFixed(1)}" x2="${PADDING.left + PLOT_W}" y2="${y.toFixed(1)}"
          stroke="#e2e8f0" stroke-width="1"/>
    <text x="${(PADDING.left - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}"
          text-anchor="end" font-size="10" fill="#64748b">${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(1)}</text>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
    <rect width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff"/>
    ${yAxisLines}
    ${bars}
    <!-- Axes -->
    <line x1="${PADDING.left}" y1="${PADDING.top}" x2="${PADDING.left}" y2="${PADDING.top + PLOT_H}" stroke="#cbd5e1" stroke-width="1.5"/>
    <line x1="${PADDING.left}" y1="${PADDING.top + PLOT_H}" x2="${PADDING.left + PLOT_W}" y2="${PADDING.top + PLOT_H}" stroke="#cbd5e1" stroke-width="1.5"/>
    <!-- Axis labels -->
    <text x="${(PADDING.left + PLOT_W / 2).toFixed(1)}" y="${(CHART_HEIGHT - 4).toFixed(1)}"
          text-anchor="middle" font-size="11" fill="#475569" font-weight="600">${escapeXml(xKey)}</text>
    <text x="14" y="${(PADDING.top + PLOT_H / 2).toFixed(1)}"
          text-anchor="middle" font-size="11" fill="#475569" font-weight="600"
          transform="rotate(-90,14,${(PADDING.top + PLOT_H / 2).toFixed(1)})">${escapeXml(yKey)}</text>
  </svg>`;
}

function generateLineChartSvg(prepared: PreparedChartData): string {
  const { data, xKey, yKey } = prepared;
  if (!data.length) return '';

  const values = data.map(d => Number(d[yKey]) || 0);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = minVal + (range * i) / tickCount;
    const y = PADDING.top + PLOT_H - ((val - minVal) / range) * PLOT_H;
    return { val, y };
  });

  const points = data.map((d, i) => {
    const x = PADDING.left + (i / Math.max(data.length - 1, 1)) * PLOT_W;
    const val = Number(d[yKey]) || 0;
    const y = PADDING.top + PLOT_H - ((val - minVal) / range) * PLOT_H;
    return { x, y, label: String(d[xKey] ?? '').slice(0, 10) };
  });

  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const dots = points.map(p =>
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${COLORS[0]}" opacity="0.8"/>`
  ).join('');

  const xLabels = points
    .filter((_, i) => data.length <= 20 || i % Math.ceil(data.length / 10) === 0)
    .map(p => `<text x="${p.x.toFixed(1)}" y="${(PADDING.top + PLOT_H + 16).toFixed(1)}"
          text-anchor="middle" font-size="9" fill="#64748b"
          transform="rotate(-35,${p.x.toFixed(1)},${(PADDING.top + PLOT_H + 16).toFixed(1)})"
          >${escapeXml(p.label)}</text>`).join('');

  const yAxisLines = yTicks.map(({ val, y }) => `
    <line x1="${PADDING.left}" y1="${y.toFixed(1)}" x2="${PADDING.left + PLOT_W}" y2="${y.toFixed(1)}"
          stroke="#e2e8f0" stroke-width="1"/>
    <text x="${(PADDING.left - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}"
          text-anchor="end" font-size="10" fill="#64748b">${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(1)}</text>
  `).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
    <rect width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff"/>
    ${yAxisLines}
    <polyline points="${polyline}" fill="none" stroke="${COLORS[0]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${xLabels}
    <!-- Axes -->
    <line x1="${PADDING.left}" y1="${PADDING.top}" x2="${PADDING.left}" y2="${PADDING.top + PLOT_H}" stroke="#cbd5e1" stroke-width="1.5"/>
    <line x1="${PADDING.left}" y1="${PADDING.top + PLOT_H}" x2="${PADDING.left + PLOT_W}" y2="${PADDING.top + PLOT_H}" stroke="#cbd5e1" stroke-width="1.5"/>
    <!-- Axis labels -->
    <text x="${(PADDING.left + PLOT_W / 2).toFixed(1)}" y="${(CHART_HEIGHT - 4).toFixed(1)}"
          text-anchor="middle" font-size="11" fill="#475569" font-weight="600">${escapeXml(xKey)}</text>
    <text x="14" y="${(PADDING.top + PLOT_H / 2).toFixed(1)}"
          text-anchor="middle" font-size="11" fill="#475569" font-weight="600"
          transform="rotate(-90,14,${(PADDING.top + PLOT_H / 2).toFixed(1)})">${escapeXml(yKey)}</text>
  </svg>`;
}

function generateScatterChartSvg(prepared: PreparedChartData): string {
  const { data, xKey, yKey } = prepared;
  if (!data.length) return '';

  const xVals = data.map(d => Number(d[xKey]) || 0);
  const yVals = data.map(d => Number(d[yKey]) || 0);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = yMin + (yRange * i) / tickCount;
    const y = PADDING.top + PLOT_H - ((val - yMin) / yRange) * PLOT_H;
    return { val, y };
  });
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = xMin + (xRange * i) / tickCount;
    const x = PADDING.left + ((val - xMin) / xRange) * PLOT_W;
    return { val, x };
  });

  const dots = data.map(d => {
    const x = PADDING.left + ((Number(d[xKey]) - xMin) / xRange) * PLOT_W;
    const y = PADDING.top + PLOT_H - ((Number(d[yKey]) - yMin) / yRange) * PLOT_H;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${COLORS[0]}" opacity="0.6"/>`;
  }).join('');

  const yAxisLines = yTicks.map(({ val, y }) => `
    <line x1="${PADDING.left}" y1="${y.toFixed(1)}" x2="${PADDING.left + PLOT_W}" y2="${y.toFixed(1)}"
          stroke="#e2e8f0" stroke-width="1"/>
    <text x="${(PADDING.left - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}"
          text-anchor="end" font-size="10" fill="#64748b">${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(1)}</text>
  `).join('');

  const xAxisLabels = xTicks.map(({ val, x }) =>
    `<text x="${x.toFixed(1)}" y="${(PADDING.top + PLOT_H + 14).toFixed(1)}"
          text-anchor="middle" font-size="10" fill="#64748b">${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(1)}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
    <rect width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff"/>
    ${yAxisLines}
    ${dots}
    ${xAxisLabels}
    <!-- Axes -->
    <line x1="${PADDING.left}" y1="${PADDING.top}" x2="${PADDING.left}" y2="${PADDING.top + PLOT_H}" stroke="#cbd5e1" stroke-width="1.5"/>
    <line x1="${PADDING.left}" y1="${PADDING.top + PLOT_H}" x2="${PADDING.left + PLOT_W}" y2="${PADDING.top + PLOT_H}" stroke="#cbd5e1" stroke-width="1.5"/>
    <!-- Axis labels -->
    <text x="${(PADDING.left + PLOT_W / 2).toFixed(1)}" y="${(CHART_HEIGHT - 4).toFixed(1)}"
          text-anchor="middle" font-size="11" fill="#475569" font-weight="600">${escapeXml(xKey)}</text>
    <text x="14" y="${(PADDING.top + PLOT_H / 2).toFixed(1)}"
          text-anchor="middle" font-size="11" fill="#475569" font-weight="600"
          transform="rotate(-90,14,${(PADDING.top + PLOT_H / 2).toFixed(1)})">${escapeXml(yKey)}</text>
  </svg>`;
}

function generatePieChartSvg(prepared: PreparedChartData): string {
  const { data, xKey, yKey } = prepared;
  if (!data.length) return '';

  const total = data.reduce((sum, d) => sum + (Number(d[yKey]) || 0), 0);
  if (total === 0) return '';

  const cx = CHART_WIDTH / 2;
  const cy = CHART_HEIGHT / 2 - 10;
  const r = Math.min(PLOT_H, PLOT_W) / 2 - 10;

  let currentAngle = -Math.PI / 2;
  const slices = data.slice(0, 10).map((d, i) => {
    const val = Number(d[yKey]) || 0;
    const angle = (val / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const midAngle = startAngle + angle / 2;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = ((val / total) * 100).toFixed(0);
    const label = String(d[xKey] ?? '').slice(0, 8);

    return `
      <path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z"
            fill="${COLORS[i % COLORS.length]}" stroke="#ffffff" stroke-width="2" opacity="0.9"/>
      ${angle > 0.3 ? `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="10" fill="#ffffff" font-weight="600">${pct}%</text>` : ''}
    `;
  }).join('');

  // Legend
  const legendItems = data.slice(0, 10).map((d, i) => {
    const lx = 20;
    const ly = 20 + i * 18;
    return `
      <rect x="${lx}" y="${(ly - 8).toFixed(1)}" width="12" height="12" fill="${COLORS[i % COLORS.length]}" rx="2"/>
      <text x="${lx + 16}" y="${ly.toFixed(1)}" font-size="10" fill="#475569">${escapeXml(String(d[xKey] ?? '').slice(0, 15))}</text>
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}">
    <rect width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#ffffff"/>
    ${slices}
    ${legendItems}
  </svg>`;
}

function generateChartSvg(prepared: PreparedChartData): string {
  const { chartType } = prepared;
  if (chartType === 'line') return generateLineChartSvg(prepared);
  if (chartType === 'scatter') return generateScatterChartSvg(prepared);
  if (chartType === 'pie') return generatePieChartSvg(prepared);
  // bar and histogram both use bar renderer
  return generateBarChartSvg(prepared);
}

// ─── Main export function ────────────────────────────────────────────────────

export async function exportToPdf(): Promise<void> {
  const state = useDataStore.getState();
  const { filename, cleanedData, columns, cleaningSummary } = state;

  if (!cleanedData || cleanedData.length === 0) {
    alert('No data loaded. Please upload a CSV file first.');
    return;
  }

  const numericCols = columns.filter(c => c.type === 'numeric');
  const categoricalCols = columns.filter(c => c.type === 'categorical');
  const dateCols = columns.filter(c => c.type === 'date');
  const numericColNames = numericCols.map(c => c.name);

  const stats = computeAllStats(cleanedData, numericColNames);
  const outliers = detectOutliers(cleanedData, numericColNames);
  const correlationMatrix = computeCorrelationMatrix(cleanedData, numericColNames);
  const insights = generateInsights(cleanedData, columns, cleaningSummary ?? undefined);

  // ── Chart generation ──────────────────────────────────────────────────────
  // First try to capture from DOM (works when Charts tab is active)
  let chartImageDataUrl = '';
  const chartEl = document.querySelector('[data-chart-id="main-chart"]') as HTMLElement | null;
  if (chartEl) {
    try {
      const svgEl = chartEl.querySelector('svg');
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = svgEl.clientWidth || 600;
            canvas.height = svgEl.clientHeight || 300;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              chartImageDataUrl = canvas.toDataURL('image/png');
            }
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          img.src = url;
        });
      }
    } catch {
      // ignore chart capture errors
    }
  }

  // If DOM capture failed or chart tab wasn't open, generate inline SVG chart
  let inlineChartSvg = '';
  if (!chartImageDataUrl) {
    try {
      const rows = cleanedData as DataRow[];
      const autoConfig = selectChartConfig(columns);
      const prepared = prepareChartData(rows, columns, autoConfig);
      if (prepared.data.length > 0) {
        inlineChartSvg = generateChartSvg(prepared);
      }
    } catch {
      // ignore chart generation errors
    }
  }

  // ── Build chart section HTML ──────────────────────────────────────────────
  let chartSectionHtml: string;
  if (chartImageDataUrl) {
    chartSectionHtml = `<img src="${chartImageDataUrl}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;" />`;
  } else if (inlineChartSvg) {
    chartSectionHtml = `<div style="width:100%;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;background:#ffffff;">${inlineChartSvg}</div>`;
  } else {
    chartSectionHtml = `<div class="chart-placeholder"><p style="color:#94a3b8;">No chart data available for this dataset.</p></div>`;
  }

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const imputedCount = cleaningSummary
    ? Object.values(cleaningSummary.imputedCells).reduce((a, b) => a + b, 0)
    : 0;

  // Build correlation table rows
  const corrRows = numericColNames.slice(0, 6).map(col => {
    const row = correlationMatrix[col] || {};
    return `<tr>
      <td style="font-weight:600;padding:6px 10px;border:1px solid #e2e8f0;background:#f8fafc;">${col}</td>
      ${numericColNames.slice(0, 6).map(col2 => {
        const val = row[col2] ?? 0;
        const abs = Math.abs(val);
        const bg = abs > 0.7 ? '#fef3c7' : abs > 0.4 ? '#e0f2fe' : '#ffffff';
        return `<td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;background:${bg};">${val.toFixed(2)}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  // Build outlier rows
  const outlierRows = Object.entries(outliers).map(([col, result]) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${col}</td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">${result.outlierCount}</td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">${result.lowerBound.toFixed(2)}</td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">${result.upperBound.toFixed(2)}</td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">${result.outlierValues.slice(0, 3).map(v => v.toFixed(2)).join(', ')}</td>
    </tr>
  `).join('');

  // Build insights HTML — severity is 'info' | 'warning' | 'success'
  const insightsHtml = insights.map(ins => {
    const color = ins.severity === 'warning' ? '#d97706' : ins.severity === 'success' ? '#16a34a' : '#2563eb';
    const bg = ins.severity === 'warning' ? '#fffbeb' : ins.severity === 'success' ? '#f0fdf4' : '#eff6ff';
    return `<div style="border-left:4px solid ${color};background:${bg};padding:12px 16px;margin-bottom:10px;border-radius:4px;">
      <div style="font-weight:700;color:${color};font-size:13px;margin-bottom:4px;">[${ins.category.toUpperCase()}] ${ins.title}</div>
      <div style="color:#374151;font-size:13px;">${ins.description}</div>
    </div>`;
  }).join('');

  // Build stats table rows
  const statsRows = Object.entries(stats).map(([col, s]) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">${col}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.count}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.mean.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.median.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.stdDev.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.min.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.max.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 10px;border:1px solid #e2e8f0;">${s.nullCount}</td>
    </tr>
  `).join('');

  // Build data preview rows (first 10 rows, first 8 columns)
  const previewCols = columns.slice(0, 8);
  const previewRows = cleanedData.slice(0, 10).map(row => `
    <tr>${previewCols.map(col => `<td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:11px;">${row[col.name] ?? ''}</td>`).join('')}</tr>
  `).join('');

  // Build column summary
  const colSummaryRows = columns.map(col => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;">${col.name}</td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">
        <span style="background:${col.type === 'numeric' ? '#dbeafe' : col.type === 'categorical' ? '#dcfce7' : '#fef3c7'};color:${col.type === 'numeric' ? '#1d4ed8' : col.type === 'categorical' ? '#15803d' : '#b45309'};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${col.type}</span>
      </td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">${stats[col.name]?.nullCount ?? 'N/A'}</td>
      <td style="text-align:center;padding:6px 10px;border:1px solid #e2e8f0;">${stats[col.name] ? `${stats[col.name].min.toFixed(2)} – ${stats[col.name].max.toFixed(2)}` : 'N/A'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>InsightIQ Report – ${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #ffffff; font-size: 13px; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 3px solid #6366f1; margin-bottom: 32px; }
    .header-left h1 { font-size: 26px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
    .header-left p { color: #64748b; font-size: 13px; margin-top: 4px; }
    .header-right { text-align: right; color: #64748b; font-size: 12px; }
    .section { margin-bottom: 36px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .section-title .badge { background: #6366f1; color: white; font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 8px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #6366f1; }
    .kpi-label { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
    .chart-placeholder { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 11px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 20px 24px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>📊 InsightIQ Analytics Report</h1>
      <p>Dataset: <strong>${filename}</strong> &nbsp;|&nbsp; Generated: ${reportDate}</p>
    </div>
    <div class="header-right">
      <div style="font-size:20px;font-weight:800;color:#6366f1;">InsightIQ</div>
      <div>Data Intelligence Platform</div>
    </div>
  </div>

  <!-- SECTION 1: KPI DASHBOARD -->
  <div class="section">
    <div class="section-title"><span class="badge">01</span> KPI Dashboard</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${cleanedData.length.toLocaleString()}</div>
        <div class="kpi-label">Total Rows</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${columns.length}</div>
        <div class="kpi-label">Columns</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${numericCols.length}</div>
        <div class="kpi-label">Numeric Cols</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${imputedCount}</div>
        <div class="kpi-label">Imputed Cells</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px;">
      <div class="kpi-card">
        <div class="kpi-value" style="font-size:20px;">${categoricalCols.length}</div>
        <div class="kpi-label">Categorical Cols</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="font-size:20px;">${dateCols.length}</div>
        <div class="kpi-label">Date Cols</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="font-size:20px;">${insights.length}</div>
        <div class="kpi-label">Insights Found</div>
      </div>
    </div>
  </div>

  <!-- SECTION 2: DATA PREVIEW -->
  <div class="section">
    <div class="section-title"><span class="badge">02</span> Data Preview <span style="font-size:12px;font-weight:400;color:#64748b;">(first 10 rows, up to 8 columns)</span></div>
    <table>
      <thead><tr>${previewCols.map(c => `<th>${c.name}</th>`).join('')}</tr></thead>
      <tbody>${previewRows}</tbody>
    </table>
  </div>

  <!-- SECTION 3: CHART -->
  <div class="section">
    <div class="section-title"><span class="badge">03</span> Primary Chart</div>
    ${chartSectionHtml}
  </div>

  <!-- SECTION 4: DESCRIPTIVE STATISTICS -->
  <div class="section">
    <div class="section-title"><span class="badge">04</span> Descriptive Statistics</div>
    ${numericColNames.length === 0
      ? '<p style="color:#94a3b8;">No numeric columns detected.</p>'
      : `<table>
          <thead><tr><th>Column</th><th>Count</th><th>Mean</th><th>Median</th><th>Std Dev</th><th>Min</th><th>Max</th><th>Nulls</th></tr></thead>
          <tbody>${statsRows}</tbody>
        </table>`
    }
  </div>

  <!-- SECTION 5: CORRELATION MATRIX -->
  <div class="section">
    <div class="section-title"><span class="badge">05</span> Correlation Matrix <span style="font-size:12px;font-weight:400;color:#64748b;">(Pearson, up to 6 columns)</span></div>
    ${numericColNames.length < 2
      ? '<p style="color:#94a3b8;">Need at least 2 numeric columns for correlation analysis.</p>'
      : `<table>
          <thead><tr><th></th>${numericColNames.slice(0, 6).map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${corrRows}</tbody>
        </table>`
    }
  </div>

  <!-- SECTION 6: OUTLIER DETECTION -->
  <div class="section">
    <div class="section-title"><span class="badge">06</span> Outlier Detection <span style="font-size:12px;font-weight:400;color:#64748b;">(IQR method)</span></div>
    ${Object.keys(outliers).length === 0
      ? '<p style="color:#94a3b8;">No outliers detected.</p>'
      : `<table>
          <thead><tr><th>Column</th><th>Outlier Count</th><th>Lower Bound</th><th>Upper Bound</th><th>Sample Outliers</th></tr></thead>
          <tbody>${outlierRows}</tbody>
        </table>`
    }
  </div>

  <!-- SECTION 7: AI INSIGHTS -->
  <div class="section">
    <div class="section-title"><span class="badge">07</span> AI-Generated Insights</div>
    ${insights.length === 0
      ? '<p style="color:#94a3b8;">No insights generated.</p>'
      : insightsHtml
    }
  </div>

  <!-- SECTION 8: PREDICTIVE MODEL -->
  <div class="section">
    <div class="section-title"><span class="badge">08</span> Predictive Model Summary</div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
      <p style="color:#475569;font-size:13px;">
        Linear regression analysis was performed on <strong>${numericColNames.length}</strong> numeric column(s).
        ${dateCols.length > 0
          ? `Trend analysis used <strong>${dateCols[0].name}</strong> as the time axis.`
          : 'No date column detected for time-series trend analysis.'
        }
      </p>
      <div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        <div class="kpi-card"><div class="kpi-value" style="font-size:18px;">${numericColNames.length}</div><div class="kpi-label">Numeric Cols Analyzed</div></div>
        <div class="kpi-card"><div class="kpi-value" style="font-size:18px;">${dateCols.length}</div><div class="kpi-label">Date Cols Found</div></div>
        <div class="kpi-card"><div class="kpi-value" style="font-size:18px;">${cleanedData.length}</div><div class="kpi-label">Data Points</div></div>
      </div>
    </div>
  </div>

  <!-- SECTION 9: COLUMN SUMMARY -->
  <div class="section">
    <div class="section-title"><span class="badge">09</span> Column Summary</div>
    <table>
      <thead><tr><th>Column Name</th><th>Type</th><th>Null Count</th><th>Range</th></tr></thead>
      <tbody>${colSummaryRows}</tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>InsightIQ Analytics Report &copy; ${new Date().getFullYear()}</div>
  </div>

</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocked. Please allow popups for this site to export PDF.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}
