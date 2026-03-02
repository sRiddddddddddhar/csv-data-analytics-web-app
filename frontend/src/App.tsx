import { useState, useEffect } from "react";
import { BarChart2, Upload } from "lucide-react";
import Sidebar from "./components/Sidebar";
import KpiDashboard from "./components/KpiDashboard";
import DataPreviewTable from "./components/DataPreviewTable";
import InsightsPanel from "./components/InsightsPanel";
import PredictiveModelPanel from "./components/PredictiveModelPanel";
import AICopilotPanel from "./components/AICopilotPanel";
import { StatisticsPanel } from "./components/analytics/StatisticsPanel";
import { CorrelationHeatmap } from "./components/analytics/CorrelationHeatmap";
import { OutlierSummary } from "./components/analytics/OutlierSummary";
import { ChartControls } from "./components/charts/ChartControls";
import { DynamicChart } from "./components/charts/DynamicChart";
import { useDataStore } from "./store/dataStore";
import CsvUpload from "./components/CsvUpload";
import LoginOverlay from "./components/LoginOverlay";
import { useAuth } from "./hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import type { ChartConfig } from "./components/charts/ChartControls";

type Section =
  | "dashboard"
  | "data"
  | "charts"
  | "statistics"
  | "correlation"
  | "outliers"
  | "insights"
  | "predictive"
  | "copilot";

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { cleanedData, columns, filename } = useDataStore();
  const { isAuthenticated, login, logout } = useAuth();

  const numericCols = columns.filter((c) => c.type === "numeric");

  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: "bar",
    xColumn: "",
    yColumn: "",
  });

  // Auto-detect columns and apply smart defaults whenever the dataset changes
  useEffect(() => {
    if (cleanedData.length === 0 || columns.length === 0) return;

    const numeric = columns.filter((c) => c.type === "numeric");
    const categorical = columns.filter((c) => c.type === "categorical");

    if (numeric.length >= 2) {
      // Rule 1: 2+ numeric columns → Scatter with first two numeric columns
      setChartConfig({
        chartType: "scatter",
        xColumn: numeric[0].name,
        yColumn: numeric[1].name,
      });
    } else if (numeric.length === 1 && categorical.length === 0) {
      // Rule 2: Only one numeric column → Histogram
      setChartConfig({
        chartType: "histogram",
        xColumn: numeric[0].name,
        yColumn: "",
      });
    } else if (numeric.length === 1 && categorical.length >= 1) {
      // Rule 3: One numeric + categorical → Bar chart
      setChartConfig({
        chartType: "bar",
        xColumn: categorical[0].name,
        yColumn: numeric[0].name,
      });
    }
    // If no numeric columns at all, leave config unchanged
  }, [cleanedData, columns]);

  const hasData = cleanedData.length > 0;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Authentication overlay — rendered on top of everything when not authenticated */}
      <LoginOverlay
        isOpen={!isAuthenticated}
        onLoginSuccess={(email) => login(email)}
      />

      <Sidebar
        activeSection={activeSection}
        onSectionChange={(s) => setActiveSection(s as Section)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-border/40 bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground text-sm">
              {filename ? (
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground font-normal">Dataset:</span>
                  <span className="text-foreground">{filename}</span>
                </span>
              ) : (
                <span className="text-muted-foreground font-normal">No dataset loaded</span>
              )}
            </span>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {hasData ? "Replace Dataset" : "Upload CSV"}
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center h-full gap-8 animate-fade-in">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-glow">
                  <BarChart2 className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">
                  Welcome to{" "}
                  <span className="text-gradient">InsightIQ</span>
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Upload a CSV file to unlock powerful analytics, AI-driven insights, predictive modeling, and interactive visualizations.
                </p>
              </div>
              <button
                onClick={() => setUploadOpen(true)}
                className="btn-gradient px-8 py-3 text-base flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Get Started — Upload CSV
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              {activeSection === "dashboard" && <KpiDashboard />}
              {activeSection === "data" && <DataPreviewTable />}
              {activeSection === "charts" && (
                <div className="space-y-6">
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title">Chart Configuration</h2>
                    </div>
                    <div className="panel-body">
                      <ChartControls
                        chartConfig={chartConfig}
                        onConfigChange={setChartConfig}
                      />
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-header">
                      <h2 className="panel-title">Visualization</h2>
                      <span className="panel-subtitle">
                        {numericCols.length} numeric columns available
                      </span>
                    </div>
                    <div className="panel-body">
                      <DynamicChart
                        chartConfig={chartConfig}
                        chartId="main-chart"
                      />
                    </div>
                  </div>
                </div>
              )}
              {activeSection === "statistics" && <StatisticsPanel />}
              {activeSection === "correlation" && <CorrelationHeatmap />}
              {activeSection === "outliers" && <OutlierSummary />}
              {activeSection === "insights" && <InsightsPanel />}
              {activeSection === "predictive" && <PredictiveModelPanel />}
              {activeSection === "copilot" && <AICopilotPanel />}
            </div>
          )}
        </main>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Dataset
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload a CSV file or load a sample dataset to begin analysis.
            </DialogDescription>
          </DialogHeader>
          <CsvUpload onClose={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
