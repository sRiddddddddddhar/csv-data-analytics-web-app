import { useMemo } from "react";
import { useDataStore } from "../../store/dataStore";
import { detectOutliers } from "../../utils/outlierDetector";
import { AlertTriangle } from "lucide-react";

export function OutlierSummary() {
  const { cleanedData, columns } = useDataStore();

  const numericColNames = useMemo(
    () => columns.filter((c) => c.type === "numeric").map((c) => c.name),
    [columns]
  );

  const results = useMemo(
    () => detectOutliers(cleanedData, numericColNames),
    [cleanedData, numericColNames]
  );

  if (cleanedData.length === 0) {
    return (
      <div id="outlier-summary" className="panel">
        <div className="panel-body flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No data loaded yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalOutliers = results.reduce((s, r) => s + r.outlierCount, 0);

  return (
    <div id="outlier-summary" className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Outlier Detection
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          IQR-based outlier analysis across {numericColNames.length} numeric columns.
        </p>
      </div>

      {/* Summary badge */}
      <div className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border
        ${totalOutliers > 0
          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
          : "bg-success/10 border-success/30 text-success"
        }
      `}>
        <AlertTriangle className="w-4 h-4" />
        {totalOutliers > 0
          ? `${totalOutliers} total outlier${totalOutliers !== 1 ? "s" : ""} detected`
          : "No outliers detected — data looks clean!"}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Outlier Summary by Column</h2>
          <span className="panel-subtitle">{results.length} columns analyzed</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/20">
                {["Column", "Q1", "Q3", "IQR", "Lower Bound", "Upper Bound", "Outliers", "Sample Values"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={r.column}
                  className={`
                    border-b border-border/20 hover:bg-secondary/30 transition-colors duration-100
                    ${i % 2 === 0 ? "" : "bg-secondary/10"}
                  `}
                >
                  <td className="px-5 py-3 font-semibold text-foreground">{r.column}</td>
                  <td className="px-5 py-3 font-mono text-foreground/80">{r.q1.toFixed(3)}</td>
                  <td className="px-5 py-3 font-mono text-foreground/80">{r.q3.toFixed(3)}</td>
                  <td className="px-5 py-3 font-mono text-foreground/80">{r.iqr.toFixed(3)}</td>
                  <td className="px-5 py-3 font-mono text-foreground/80">{r.lowerBound.toFixed(3)}</td>
                  <td className="px-5 py-3 font-mono text-foreground/80">{r.upperBound.toFixed(3)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`
                        inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 rounded-full text-xs font-bold
                        ${r.outlierCount > 0
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-success/15 text-success border border-success/30"
                        }
                      `}
                    >
                      {r.outlierCount}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {r.outlierValues?.slice(0, 3).map((v) => v.toFixed(2)).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
