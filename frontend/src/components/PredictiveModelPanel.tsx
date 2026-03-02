import { useState, useMemo } from "react";
import { useDataStore } from "../store/dataStore";
import { linearRegression, detectTrends } from "../utils/regressionEngine";
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  Loader2,
  BarChart2,
} from "lucide-react";

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  dataPoints: number;
  trend: "rising" | "falling" | "flat";
}

function computeRegression(
  data: Record<string, unknown>[],
  xColName: string,
  yColName: string,
  isDateCol: boolean
): RegressionResult | null {
  if (isDateCol) {
    const trends = detectTrends(data, xColName, [yColName]);
    const t = trends[0];
    if (!t) return null;
    return {
      slope: t.slope,
      intercept: 0,
      rSquared: t.rSquared,
      dataPoints: data.length,
      trend: t.direction,
    };
  }

  const pairs = data
    .map((row) => ({ x: Number(row[xColName]), y: Number(row[yColName]) }))
    .filter((p) => !isNaN(p.x) && !isNaN(p.y));

  if (pairs.length < 2) return null;

  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  const { slope, intercept, rSquared } = linearRegression(xs, ys);
  const trend: "rising" | "falling" | "flat" =
    Math.abs(slope) < 1e-10 ? "flat" : slope > 0 ? "rising" : "falling";

  return { slope, intercept, rSquared, dataPoints: pairs.length, trend };
}

export default function PredictiveModelPanel() {
  const { cleanedData, columns } = useDataStore();
  const [targetCol, setTargetCol] = useState("");
  const [predictorCol, setPredictorCol] = useState("");
  const [result, setResult] = useState<RegressionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericCols = useMemo(
    () => columns.filter((c) => c.type === "numeric"),
    [columns]
  );
  const dateCols = useMemo(
    () => columns.filter((c) => c.type === "date"),
    [columns]
  );

  const predictorOptions = useMemo(
    () => [...dateCols, ...numericCols],
    [dateCols, numericCols]
  );

  const effectiveTarget = targetCol || numericCols[0]?.name || "";
  const effectivePredictor =
    predictorCol ||
    predictorOptions.find((c) => c.name !== effectiveTarget)?.name ||
    "";

  const canRun = !!effectiveTarget && !!effectivePredictor && !running && cleanedData.length > 0;

  const handleRun = async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      // Small delay for UX feedback
      await new Promise((r) => setTimeout(r, 300));
      const isDatePredictor = dateCols.some((c) => c.name === effectivePredictor);
      const res = computeRegression(cleanedData, effectivePredictor, effectiveTarget, isDatePredictor);
      if (!res) throw new Error("Not enough valid data points to run regression.");
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regression failed.");
    } finally {
      setRunning(false);
    }
  };

  if (cleanedData.length === 0) {
    return (
      <div id="predictive-model-panel" className="panel">
        <div className="panel-body flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <BrainCircuit className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No data loaded yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const TrendIcon =
    result?.trend === "rising"
      ? TrendingUp
      : result?.trend === "falling"
      ? TrendingDown
      : Minus;

  const trendColor =
    result?.trend === "rising"
      ? "text-emerald-400"
      : result?.trend === "falling"
      ? "text-rose-400"
      : "text-muted-foreground";

  return (
    <div id="predictive-model-panel" className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Predictive Modeling
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Run linear regression to identify trends and forecast values.
        </p>
      </div>

      {/* Config panel */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Regression Configuration</h2>
        </div>
        <div className="panel-body space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Predictor column */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Predictor Column (X)
              </label>
              <p className="text-xs text-muted-foreground">
                The independent variable
              </p>
              <select
                value={effectivePredictor}
                onChange={(e) => {
                  setPredictorCol(e.target.value);
                  setResult(null);
                }}
                className="
                  w-full bg-secondary/50 border border-border/60 text-foreground
                  rounded-xl px-3 py-2.5 text-sm
                  focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                  transition-all duration-200
                "
              >
                <option value="">Select predictor column…</option>
                {predictorOptions.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Target column */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Target Column (Y)
              </label>
              <p className="text-xs text-muted-foreground">
                The dependent variable
              </p>
              <select
                value={effectiveTarget}
                onChange={(e) => {
                  setTargetCol(e.target.value);
                  setResult(null);
                }}
                className="
                  w-full bg-secondary/50 border border-border/60 text-foreground
                  rounded-xl px-3 py-2.5 text-sm
                  focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                  transition-all duration-200
                "
              >
                <option value="">Select target column…</option>
                {numericCols.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="
              flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-indigo-500 to-violet-500 text-white
              hover:from-indigo-400 hover:to-violet-400
              active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
              transition-all duration-200 shadow-md hover:shadow-glow
            "
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Regression…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Regression
              </>
            )}
          </button>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "R² Score", value: result.rSquared.toFixed(4), color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
              { label: "Slope", value: result.slope.toFixed(4), color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
              { label: "Intercept", value: result.intercept.toFixed(4), color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
              { label: "Data Points", value: result.dataPoints.toString(), color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            ].map((metric) => (
              <div
                key={metric.label}
                className={`bg-card border rounded-2xl p-5 ${metric.border} hover:-translate-y-0.5 transition-all duration-200`}
              >
                <div className={`w-9 h-9 rounded-xl ${metric.bg} flex items-center justify-center mb-3`}>
                  <BarChart2 className={`w-4 h-4 ${metric.color}`} />
                </div>
                <p className={`text-2xl font-bold ${metric.color} font-mono`}>
                  {metric.value}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>

          {/* Trend */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Trend Analysis</h2>
            </div>
            <div className="panel-body">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                  <TrendIcon className={`w-6 h-6 ${trendColor}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold capitalize ${trendColor}`}>
                    {result.trend}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.trend === "rising"
                      ? "The target variable shows an upward trend."
                      : result.trend === "falling"
                      ? "The target variable shows a downward trend."
                      : "The target variable remains relatively stable."}
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-secondary/30 border border-border/30">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Equation: </span>
                  <span className="font-mono text-primary">
                    {effectiveTarget} = {result.slope.toFixed(4)} × {effectivePredictor} + {result.intercept.toFixed(4)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  R² = {result.rSquared.toFixed(4)} — the model explains{" "}
                  <span className="font-semibold text-foreground">
                    {(result.rSquared * 100).toFixed(1)}%
                  </span>{" "}
                  of the variance in {effectiveTarget}.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
