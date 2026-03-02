import { useMemo } from "react";
import { useDataStore } from "../../store/dataStore";
import { computeCorrelationMatrix } from "../../utils/correlationEngine";
import { GitBranch } from "lucide-react";

export function CorrelationHeatmap() {
  const { cleanedData, columns } = useDataStore();

  const numericCols = useMemo(
    () => columns.filter((c) => c.type === "numeric").map((c) => c.name),
    [columns]
  );

  const matrix = useMemo(
    () => computeCorrelationMatrix(cleanedData, numericCols),
    [cleanedData, numericCols]
  );

  if (cleanedData.length === 0) {
    return (
      <div id="correlation-heatmap" className="panel">
        <div className="panel-body flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <GitBranch className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No data loaded yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const getColor = (value: number): string => {
    if (value >= 0.8) return "bg-indigo-500 text-white";
    if (value >= 0.6) return "bg-indigo-400/80 text-white";
    if (value >= 0.4) return "bg-indigo-300/60 text-foreground";
    if (value >= 0.2) return "bg-indigo-200/40 text-foreground";
    if (value >= 0) return "bg-secondary/60 text-muted-foreground";
    if (value >= -0.2) return "bg-rose-200/30 text-foreground";
    if (value >= -0.4) return "bg-rose-300/50 text-foreground";
    if (value >= -0.6) return "bg-rose-400/70 text-white";
    if (value >= -0.8) return "bg-rose-500/80 text-white";
    return "bg-rose-600 text-white";
  };

  return (
    <div id="correlation-heatmap" className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Correlation Heatmap
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pearson correlation coefficients between {numericCols.length} numeric columns.
        </p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Pearson Correlation Matrix</h2>
          <span className="panel-subtitle">{numericCols.length} × {numericCols.length}</span>
        </div>
        <div className="panel-body overflow-x-auto">
          <table className="text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-28" />
                {numericCols.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-1 text-center font-semibold text-muted-foreground max-w-[80px] truncate"
                    title={col}
                  >
                    <div className="truncate max-w-[72px]">{col}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {numericCols.map((rowCol) => (
                <tr key={rowCol}>
                  <td className="pr-3 py-1 text-right font-semibold text-muted-foreground max-w-[112px] truncate" title={rowCol}>
                    <div className="truncate">{rowCol}</div>
                  </td>
                  {numericCols.map((colCol) => {
                    const val = matrix[rowCol]?.[colCol] ?? 0;
                    return (
                      <td key={colCol} className="p-0.5">
                        <div
                          className={`
                            w-16 h-10 flex items-center justify-center rounded-lg
                            text-xs font-semibold transition-all duration-150
                            hover:scale-105 hover:z-10 relative cursor-default
                            ${getColor(val)}
                          `}
                          title={`${rowCol} × ${colCol}: ${val.toFixed(3)}`}
                        >
                          {val.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Correlation:</span>
            <div className="flex items-center gap-1">
              <div className="w-8 h-5 rounded bg-rose-600 text-white text-xs flex items-center justify-center font-semibold">-1</div>
              <div className="w-8 h-5 rounded bg-rose-400/70" />
              <div className="w-8 h-5 rounded bg-secondary/60" />
              <div className="w-8 h-5 rounded bg-indigo-400/80" />
              <div className="w-8 h-5 rounded bg-indigo-500 text-white text-xs flex items-center justify-center font-semibold">+1</div>
            </div>
            <span className="text-xs text-muted-foreground">Strong negative → Strong positive</span>
          </div>
        </div>
      </div>
    </div>
  );
}
