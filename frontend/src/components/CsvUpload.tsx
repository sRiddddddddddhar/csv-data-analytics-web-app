import { useState, useRef } from "react";
import { useDataStore } from "../store/dataStore";
import { parseCSV } from "../utils/csvParser";
import { detectColumnTypes } from "../utils/columnTypeDetector";
import { cleanData } from "../utils/dataCleanser";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";

interface CsvUploadProps {
  onClose?: () => void;
}

const SAMPLE_CSV = `Name,Age,Salary,Department,YearsExperience,PerformanceScore,Promoted
Alice,29,72000,Engineering,5,88,Yes
Bob,34,85000,Marketing,8,76,No
Carol,27,61000,Engineering,3,91,Yes
David,45,110000,Management,20,82,No
Eve,31,78000,Sales,6,79,Yes
Frank,38,95000,Engineering,12,85,No
Grace,26,58000,Marketing,2,93,Yes
Henry,52,125000,Management,25,71,No
Iris,29,69000,Sales,4,87,Yes
Jack,36,88000,Engineering,10,80,No
Karen,41,102000,Management,16,78,Yes
Leo,28,65000,Marketing,3,90,No
Mia,33,81000,Sales,7,84,Yes
Nathan,47,118000,Engineering,22,75,No
Olivia,30,74000,Marketing,5,89,Yes
Paul,39,97000,Management,14,77,No
Quinn,25,55000,Sales,1,94,Yes
Rachel,44,108000,Engineering,19,81,No
Sam,32,79000,Marketing,6,86,Yes
Tina,37,92000,Sales,11,83,No`;

export default function CsvUpload({ onClose }: CsvUploadProps) {
  const { setDataset } = useDataStore();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      if (rows.length === 0) throw new Error("CSV file is empty or has no data rows.");
      // detectColumnTypes(rows, headers) — rows first, headers second
      const columns = detectColumnTypes(rows, headers);
      const { cleaned, summary } = cleanData(rows, columns);
      // setDataset takes 5 positional args: filename, rawData, cleanedData, columns, cleaningSummary
      setDataset(file.name, rows, cleaned, columns, summary);
      setSuccess(true);
      if (onClose) {
        setTimeout(() => onClose(), 800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CSV.");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a valid CSV file.");
      return;
    }
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const loadSampleData = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const file = new File([blob], "sample_employees.csv", { type: "text/csv" });
    processFile(file);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
          transition-all duration-200
          ${dragging
            ? "border-primary/70 bg-primary/10 shadow-glow"
            : "border-border/50 hover:border-primary/40 hover:bg-secondary/30"
          }
          ${loading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : success ? (
            <CheckCircle2 className="w-10 h-10 text-success" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {loading
                ? "Processing file…"
                : success
                ? "Dataset loaded successfully!"
                : "Drop your CSV file here"}
            </p>
            {!loading && !success && (
              <p className="text-xs text-muted-foreground">
                or click to browse · CSV files only
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Sample dataset */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            Or try a sample dataset
          </p>
        </div>
        <button
          onClick={loadSampleData}
          disabled={loading}
          className="
            w-full flex items-start gap-3 p-4 rounded-xl text-left
            bg-secondary/40 border border-border/40
            hover:bg-secondary/70 hover:border-primary/30
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 group
          "
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Employee Dataset</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              20 employees with salary, department, performance, and promotion data
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
