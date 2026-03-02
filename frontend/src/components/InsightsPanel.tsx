import { useMemo } from "react";
import { useDataStore } from "../store/dataStore";
import { generateInsights } from "../utils/insightsGenerator";
import type { Insight } from "../utils/insightsGenerator";
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Info,
  Zap,
} from "lucide-react";

const severityConfig = {
  high: {
    label: "High",
    className: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    border: "border-l-rose-500",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    border: "border-l-amber-500",
    icon: Zap,
  },
  low: {
    label: "Low",
    className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    border: "border-l-indigo-500",
    icon: Info,
  },
};

export default function InsightsPanel() {
  const { cleanedData, columns } = useDataStore();

  const insights: Insight[] = useMemo(() => {
    if (cleanedData.length === 0) return [];
    return generateInsights(cleanedData, columns);
  }, [cleanedData, columns]);

  if (cleanedData.length === 0) {
    return (
      <div className="panel">
        <div className="panel-body flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Lightbulb className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No data loaded yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const grouped = insights.reduce<Record<string, Insight[]>>((acc, insight) => {
    const cat = insight.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(insight);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          AI-Generated Insights
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {insights.length} insight{insights.length !== 1 ? "s" : ""} discovered across your dataset.
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="panel">
          <div className="panel-body flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">No significant insights found.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">{category}</h2>
                <span className="text-xs font-medium text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((insight, idx) => {
                  const sev = severityConfig[insight.severity] || severityConfig.low;
                  const SevIcon = sev.icon;
                  return (
                    <div
                      key={idx}
                      className={`
                        bg-card border border-border/40 rounded-2xl p-5
                        border-l-4 ${sev.border}
                        hover:bg-secondary/20 transition-all duration-200
                        hover:-translate-y-0.5 hover:shadow-card-hover
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg ${sev.className.split(" ").slice(0, 2).join(" ")}`}>
                          <SevIcon className={`w-3.5 h-3.5 ${sev.className.split(" ")[1]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="text-sm font-semibold text-foreground">
                              {insight.title}
                            </h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${sev.className}`}>
                              {sev.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
