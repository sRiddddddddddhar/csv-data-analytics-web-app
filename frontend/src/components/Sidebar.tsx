import { useState } from "react";
import {
  LayoutDashboard,
  Table2,
  BarChart2,
  TrendingUp,
  GitBranch,
  AlertTriangle,
  Lightbulb,
  BrainCircuit,
  Bot,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useDataStore } from "../store/dataStore";
import { exportToPdf } from "../utils/pdfExporter";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onLogout?: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "data", label: "Data Preview", icon: Table2 },
  { id: "charts", label: "Charts", icon: BarChart2 },
  { id: "statistics", label: "Statistics", icon: TrendingUp },
  { id: "correlation", label: "Correlation", icon: GitBranch },
  { id: "outliers", label: "Outliers", icon: AlertTriangle },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "predictive", label: "Predictive", icon: BrainCircuit },
  { id: "copilot", label: "AI Copilot", icon: Bot },
];

export default function Sidebar({
  activeSection,
  onSectionChange,
  collapsed,
  onCollapsedChange,
  onLogout,
}: SidebarProps) {
  const { filename } = useDataStore();
  const [exporting, setExporting] = useState(false);
  const hasData = !!filename;

  const handleExport = async () => {
    if (!hasData || exporting) return;
    setExporting(true);
    try {
      await exportToPdf();
    } finally {
      setExporting(false);
    }
  };

  return (
    <aside
      className={`
        flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out
        bg-sidebar border-r border-sidebar-border
        ${collapsed ? "w-16" : "w-60"}
      `}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border/60 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-glow-sm shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground text-sm tracking-tight truncate">
              InsightIQ
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-glow-sm mx-auto">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => onCollapsedChange(true)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-150 shrink-0"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => onCollapsedChange(false)}
          className="mx-auto mt-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all duration-150"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 cursor-pointer select-none text-left
                ${isActive
                  ? "bg-primary/15 text-primary border-l-2 border-primary shadow-[0_0_12px_rgba(99,102,241,0.2)] pl-[10px]"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent pl-[10px]"
                }
                ${collapsed ? "justify-center px-0 pl-0" : ""}
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`shrink-0 transition-colors duration-200 ${
                  collapsed ? "w-5 h-5" : "w-4 h-4"
                } ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
              />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions: PDF Export + Logout */}
      <div className="shrink-0 p-3 border-t border-sidebar-border/60 space-y-2">
        {/* PDF Export */}
        <button
          onClick={handleExport}
          disabled={!hasData || exporting}
          className={`
            w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200
            ${collapsed ? "justify-center" : ""}
            ${hasData && !exporting
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 active:scale-95 shadow-glow-sm hover:shadow-glow"
              : "bg-secondary/40 text-muted-foreground/50 cursor-not-allowed opacity-50"
            }
          `}
          title={collapsed ? "Export PDF" : undefined}
        >
          <FileDown className={`shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`} />
          {!collapsed && (
            <span>{exporting ? "Exporting…" : "Export PDF"}</span>
          )}
        </button>

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            className={`
              w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200 text-muted-foreground
              hover:bg-destructive/10 hover:text-destructive
              ${collapsed ? "justify-center" : ""}
            `}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className={`shrink-0 ${collapsed ? "w-5 h-5" : "w-4 h-4"}`} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
