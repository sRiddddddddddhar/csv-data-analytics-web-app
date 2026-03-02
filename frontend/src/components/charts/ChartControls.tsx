import { useDataStore } from "../../store/dataStore";
import { BarChart2, TrendingUp, ScatterChart, PieChart, BarChartHorizontal } from "lucide-react";

export type ChartType = "bar" | "line" | "scatter" | "pie" | "histogram";

export interface ChartConfig {
  chartType: ChartType;
  xColumn: string;
  yColumn: string;
}

interface ChartControlsProps {
  chartConfig: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
}

const CHART_TYPES: Array<{ type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: "bar", label: "Bar", icon: BarChart2 },
  { type: "line", label: "Line", icon: TrendingUp },
  { type: "scatter", label: "Scatter", icon: ScatterChart },
  { type: "pie", label: "Pie", icon: PieChart },
  { type: "histogram", label: "Histogram", icon: BarChartHorizontal },
];

export function ChartControls({ chartConfig, onConfigChange }: ChartControlsProps) {
  const { columns } = useDataStore();

  return (
    <div className="space-y-5">
      {/* Chart type selector */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Chart Type</label>
        <div className="flex flex-wrap gap-2">
          {CHART_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => onConfigChange({ ...chartConfig, chartType: type })}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                border transition-all duration-150
                ${chartConfig.chartType === type
                  ? "bg-primary/20 border-primary/50 text-primary shadow-glow-sm"
                  : "bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground hover:border-border/60"
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Axis selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">X Axis</label>
          <select
            value={chartConfig.xColumn}
            onChange={(e) => onConfigChange({ ...chartConfig, xColumn: e.target.value })}
            className="
              w-full bg-secondary/50 border border-border/60 text-foreground
              rounded-xl px-3 py-2.5 text-sm
              focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
              transition-all duration-200
            "
          >
            <option value="">Select column…</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Y Axis</label>
          <select
            value={chartConfig.yColumn}
            onChange={(e) => onConfigChange({ ...chartConfig, yColumn: e.target.value })}
            className="
              w-full bg-secondary/50 border border-border/60 text-foreground
              rounded-xl px-3 py-2.5 text-sm
              focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
              transition-all duration-200
            "
          >
            <option value="">Select column…</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
