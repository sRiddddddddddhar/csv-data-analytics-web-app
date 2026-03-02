import { useMemo, useId } from "react";
import { useDataStore } from "../../store/dataStore";
import { prepareChartData } from "../../utils/chartSelector";
import type { ChartConfig } from "./ChartControls";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart2 } from "lucide-react";

interface DynamicChartProps {
  chartConfig: ChartConfig;
  chartId?: string;
}

// Soft pastel palette for dark mode
const DARK_PALETTE = [
  "#818cf8", // indigo-400
  "#a78bfa", // violet-400
  "#34d399", // emerald-400
  "#fb923c", // orange-400
  "#f472b6", // pink-400
  "#38bdf8", // sky-400
  "#facc15", // yellow-400
  "#4ade80", // green-400
];

const AXIS_STYLE = {
  tick: { fill: "#94a3b8", fontSize: 11, fontFamily: "Inter, sans-serif" },
  axisLine: { stroke: "rgba(148,163,184,0.15)" },
  tickLine: { stroke: "rgba(148,163,184,0.15)" },
};

const GRID_STYLE = {
  stroke: "rgba(148,163,184,0.08)",
  strokeDasharray: "3 3",
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color?: string; fill?: string; name: string; value: unknown }>;
  label?: unknown;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 shadow-xl text-xs">
      {label !== undefined && (
        <p className="text-slate-400 font-medium mb-2 border-b border-white/10 pb-1.5">
          {String(label)}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color || entry.fill }}
          />
          <span className="text-slate-300 font-medium">{entry.name}:</span>
          <span className="text-white font-semibold">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
              : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function DynamicChart({ chartConfig, chartId }: DynamicChartProps) {
  const { cleanedData, columns } = useDataStore();
  const generatedId = useId();
  const resolvedId = chartId ?? `chart-${generatedId}`;

  const prepared = useMemo(() => {
    if (!cleanedData.length || !columns.length) return null;
    if (!chartConfig.xColumn || !chartConfig.yColumn) return null;
    // Cast DataRow (Record<string,unknown>) to the narrower type expected by prepareChartData
    const rows = cleanedData as Record<string, string | number | null>[];
    return prepareChartData(rows, columns, chartConfig);
  }, [cleanedData, columns, chartConfig]);

  if (!prepared || prepared.data.length === 0) {
    return (
      <div
        data-chart-id={resolvedId}
        className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground"
      >
        <BarChart2 className="w-10 h-10 opacity-30" />
        <p className="text-sm">
          {!cleanedData.length
            ? "Upload a CSV file to visualize your data."
            : "Select valid X and Y columns to render the chart."}
        </p>
      </div>
    );
  }

  const { chartType, data, xKey, yKey } = prepared;

  const commonProps = {
    data,
    margin: { top: 10, right: 20, left: 0, bottom: 40 },
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey={xKey}
              {...AXIS_STYLE}
              angle={-35}
              textAnchor="end"
              interval="preserveStartEnd"
            />
            <YAxis {...AXIS_STYLE} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Bar dataKey={yKey} fill={DARK_PALETTE[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey={xKey}
              {...AXIS_STYLE}
              angle={-35}
              textAnchor="end"
              interval="preserveStartEnd"
            />
            <YAxis {...AXIS_STYLE} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={DARK_PALETTE[0]}
              strokeWidth={2}
              dot={{ fill: DARK_PALETTE[0], r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        );

      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey={xKey} name={xKey} {...AXIS_STYLE} />
            <YAxis dataKey={yKey} name={yKey} {...AXIS_STYLE} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(148,163,184,0.2)" }} />
            <Scatter name={`${xKey} vs ${yKey}`} fill={DARK_PALETTE[1]} opacity={0.75} />
          </ScatterChart>
        );

      case "pie":
        return (
          <PieChart margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={130}
              innerRadius={50}
              paddingAngle={2}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${String(name).slice(0, 12)} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: "rgba(148,163,184,0.3)" }}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={DARK_PALETTE[index % DARK_PALETTE.length]}
                  opacity={0.9}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
          </PieChart>
        );

      case "histogram":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey={xKey}
              {...AXIS_STYLE}
              angle={-35}
              textAnchor="end"
              interval="preserveStartEnd"
            />
            <YAxis {...AXIS_STYLE} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} fill={DARK_PALETTE[2]} radius={[3, 3, 0, 0]} />
          </BarChart>
        );

      default:
        return null;
    }
  };

  const chart = renderChart();
  if (!chart) return null;

  return (
    <div data-chart-id={resolvedId} className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
}

export default DynamicChart;
