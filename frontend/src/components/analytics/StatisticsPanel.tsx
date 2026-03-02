import { useMemo } from "react";
import { useDataStore } from "../../store/dataStore";
import { computeAllStats } from "../../utils/statisticsEngine";
import { TrendingUp } from "lucide-react";

export function StatisticsPanel() {
  const { cleanedData, columns } = useDataStore();

  const numericColNames = useMemo(
    () => columns.filter((c) => c.type === "numeric").map((c) => c.name),
    [columns]
  );

  const stats = useMemo(
    () => computeAllStats(cleanedData, numericColNames),
    [cleanedData, numericColNames]
  );

  if (cleanedData.length === 0) {
    return (
      <div id="statistics-panel" className="panel">
        <div className="panel-body flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No data loaded yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const statKeys: Array<{ key: keyof typeof stats[string]; label: string }> = [
    { key: "count", label: "Count" },
    { key: "mean", label: "Mean" },
    { key: "median", label: "Median" },
    { key: "min", label: "Min" },
    { key: "max", label: "Max" },
    { key: "stdDev", label: "Std Dev" },
    { key: "variance", label: "Variance" },
    { key: "nullCount", label: "Nulls" },
  ];

  return (
    <div id="statistics-panel" className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Descriptive Statistics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Statistical summary for {numericColNames.length} numeric column{numericColNames.length !== 1 ? "s" : ""}.
        </p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Summary Table</h2>
          <span className="panel-subtitle">{numericColNames.length} columns</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-secondary/20">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-card/90 backdrop-blur-sm">
                  Column
                </th>
                {statKeys.map((s) => (
                  <th
                    key={s.key}
                    className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numericColNames.map((col, i) => {
                const s = stats[col];
                if (!s) return null;
                return (
                  <tr
                    key={col}
                    className={`
                      border-b border-border/20 hover:bg-secondary/30 transition-colors duration-100
                      ${i % 2 === 0 ? "" : "bg-secondary/10"}
                    `}
                  >
                    <td className="px-5 py-3 font-semibold text-foreground sticky left-0 bg-card/90 backdrop-blur-sm">
                      {col}
                    </td>
                    {statKeys.map((sk) => (
                      <td
                        key={sk.key}
                        className="px-4 py-3 text-right font-mono text-sm text-foreground/80"
                      >
                        {typeof s[sk.key] === "number"
                          ? (s[sk.key] as number).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })
                          : String(s[sk.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
