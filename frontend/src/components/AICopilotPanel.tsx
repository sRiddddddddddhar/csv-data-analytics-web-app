import { useState, useRef, useEffect, useId } from "react";
import { useDataStore } from "../store/dataStore";
import { processQuery, type CopilotResponse } from "../utils/aiCopilotEngine";
import { DynamicChart } from "./charts/DynamicChart";
import type { ChartConfig } from "./charts/ChartControls";
import { Bot, User, Send, Sparkles, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  response?: CopilotResponse;
  chartConfig?: ChartConfig;
  chartId?: string;
}

export default function AICopilotPanel() {
  const { cleanedData, columns } = useDataStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();
  const chartCountRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response: CopilotResponse = processQuery(query, cleanedData, columns);
      chartCountRef.current += 1;
      const chartId = `${baseId}-chart-${chartCountRef.current}`;

      // CopilotResponse has: text, chart?
      // chart has: type, data, xKey, yKey, title
      let chartConfig: ChartConfig | undefined;
      if (response.chart) {
        const validTypes = ["bar", "line", "scatter", "pie", "histogram"] as const;
        const chartType = validTypes.includes(response.chart.type as typeof validTypes[number])
          ? (response.chart.type as ChartConfig["chartType"])
          : "bar";
        chartConfig = {
          chartType,
          xColumn: response.chart.xKey,
          yColumn: response.chart.yKey,
        };
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: response.text,
        response,
        chartConfig,
        chartId,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasData = cleanedData.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Copilot
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ask questions about your data in natural language.
        </p>
      </div>

      {/* Chat container */}
      <div className="flex-1 flex flex-col panel overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-glow">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-base font-semibold text-foreground">
                  {hasData ? "Ready to analyze your data" : "No dataset loaded"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {hasData
                    ? "Ask me anything about your dataset — trends, correlations, summaries, or predictions."
                    : "Upload a CSV file first, then come back to chat with your data."}
                </p>
              </div>
              {hasData && (
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
                  {[
                    "What are the key trends in this data?",
                    "Which columns are most correlated?",
                    "Show me a summary of the dataset",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left text-xs text-muted-foreground bg-secondary/40 hover:bg-secondary/70 border border-border/40 hover:border-primary/30 rounded-xl px-3 py-2 transition-all duration-150"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`
                  w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                  ${msg.role === "user"
                    ? "bg-gradient-to-br from-indigo-500 to-violet-500"
                    : "bg-secondary border border-border/50"
                  }
                `}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-primary" />
                )}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col gap-2 max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`
                    px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === "user"
                      ? "bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/30 rounded-tr-sm text-foreground"
                      : "bg-secondary/60 border border-border/40 rounded-tl-sm text-foreground"
                    }
                  `}
                >
                  {msg.content}
                </div>

                {/* Inline chart */}
                {msg.chartConfig && msg.chartId && hasData && (
                  <div className="w-full max-w-lg panel p-4">
                    <DynamicChart
                      chartConfig={msg.chartConfig}
                      chartId={msg.chartId}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-secondary border border-border/50 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-secondary/60 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing your data…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-border/40 p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasData ? "Ask about your data… (Enter to send)" : "Upload a dataset first…"}
                disabled={!hasData || loading}
                rows={1}
                className="
                  w-full resize-none bg-secondary/50 border border-border/60 text-foreground
                  placeholder:text-muted-foreground/50 rounded-xl px-4 py-3 text-sm
                  focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 max-h-32 overflow-y-auto
                "
                style={{ minHeight: "44px" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!hasData || loading || !input.trim()}
              className="
                w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                bg-gradient-to-br from-indigo-500 to-violet-500 text-white
                hover:from-indigo-400 hover:to-violet-400
                active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200 shadow-glow-sm hover:shadow-glow
              "
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground/40 mt-2 text-center">
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
