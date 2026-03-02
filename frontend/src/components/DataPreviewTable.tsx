import { useState, useMemo } from "react";
import { useDataStore } from "../store/dataStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Database } from "lucide-react";

const PAGE_SIZE = 20;

type SortDir = "asc" | "desc" | null;

export default function DataPreviewTable() {
  const { cleanedData, columns, filename } = useDataStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return cleanedData;
    const q = search.toLowerCase();
    return cleanedData.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [cleanedData, search]);

  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const an = Number(av);
      const bn = Number(bv);
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortCol(null);
      setSortDir(null);
    }
    setPage(1);
  };

  if (cleanedData.length === 0) {
    return (
      <div id="data-preview-table" className="panel">
        <div className="panel-body flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Database className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">No data loaded yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="data-preview-table" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Data Preview
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {filename} — {cleanedData.length.toLocaleString()} rows × {columns.length} columns
        </p>
      </div>

      <div className="panel">
        {/* Search bar */}
        <div className="panel-header">
          <h2 className="panel-title">Table View</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search rows…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="
                pl-9 pr-4 py-2 text-sm rounded-xl
                bg-secondary/50 border border-border/60 text-foreground
                placeholder:text-muted-foreground/50
                focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                transition-all duration-200 w-56
              "
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="cursor-pointer select-none text-muted-foreground font-semibold text-xs uppercase tracking-wider hover:text-foreground transition-colors duration-150 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      {col.name}
                      {sortCol === col.name ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-primary" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((row, i) => (
                <TableRow
                  key={i}
                  className="border-border/20 hover:bg-secondary/30 transition-colors duration-100"
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.name}
                      className="text-sm text-foreground/80 font-mono whitespace-nowrap py-2.5"
                    >
                      {String(row[col.name] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="panel-header border-t border-b-0 border-border/40">
          <span className="text-xs text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(page * PAGE_SIZE, sorted.length).toLocaleString()} of{" "}
            {sorted.length.toLocaleString()} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
