import { useMemo } from "react";
import { useDataStore } from "../store/dataStore";
import { detectOutliers } from "../utils/outlierDetector";
import {
  Database,
  Columns,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

export default function KpiDashboard() {
  const { cleanedData, columns, cleaningSummary } = useDataStore();

  const numericColNames = useMemo(
    () => columns.filter((c) => c.type === "numeric").map((c) => c.name),
    [columns]
  );

  const outlierCount = useMemo(() => {
    if (numericColNames.length === 0) return 0;
    const results = detectOutliers(cleanedData, numericColNames);
    return results.reduce((sum, r) => sum + r.outlierCount, 0);
  }, [cleanedData, numericColNames]);

  // CleaningSummary has: totalRows, cleanedRows, imputedCells (Record<string,number>), missingBeforeImputation
  const totalMissing: number = cleaningSummary?.missingBeforeImputation ?? 0;

  const kpis = [
    {
      label: "Total Rows",
      value: cleanedData.length.toLocaleString(),
      icon: Database,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
      glow: "hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]",
    },
    {
      label: "Columns",
      value: columns.length.toLocaleString(),
      icon: Columns,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      glow: "hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]",
    },
    {
      label: "Missing Values",
      value: totalMissing.toLocaleString(),
      icon: AlertCircle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    },
    {
      label: "Outliers Detected",
      value: outlierCount.toLocaleString(),
      icon: TrendingUp,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      glow: "hover:shadow-[0_0_20px_rgba(244,63,94,0.25)]",
    },
  ];

  return (
    <div id="kpi-dashboard" className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Overview of your dataset's key metrics and statistics.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`
                bg-card border rounded-2xl p-6 transition-all duration-300 cursor-default
                ${kpi.border} ${kpi.glow}
                hover:-translate-y-1
              `}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold text-foreground tracking-tight">
                  {kpi.value}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Column Overview */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Column Overview</h2>
          <span className="panel-subtitle">{columns.length} columns detected</span>
        </div>
        <div className="panel-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {columns.map((col) => (
              <div
                key={col.name}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/30 hover:bg-secondary/60 transition-colors duration-150"
              >
                <span className="text-sm font-medium text-foreground truncate mr-2">
                  {col.name}
                </span>
                <span
                  className={`
                    text-xs font-semibold px-2.5 py-1 rounded-full shrink-0
                    ${col.type === "numeric"
                      ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                      : col.type === "date"
                      ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
                      : "bg-slate-500/15 text-slate-400 border border-slate-500/20"
                    }
                  `}
                >
                  {col.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cleaning Summary */}
      {cleaningSummary && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Data Cleaning Summary</h2>
            <span className="panel-subtitle">Auto-imputed missing values</span>
          </div>
          <div className="panel-body">
            {Object.keys(cleaningSummary.imputedCells).length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No missing values found — dataset is clean!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(cleaningSummary.imputedCells).map(([col, count]) => (
                  <div
                    key={col}
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/30"
                  >
                    <span className="text-sm font-medium text-foreground">{col}</span>
                    <span className="text-sm font-semibold text-amber-400">
                      {count} imputed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
