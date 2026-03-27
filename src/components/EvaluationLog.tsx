import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  timestamp: string;
  preprocessingSteps: string[];
  rawModelOutput: string;
  level: string;
  confidence: number;
}

interface EvaluationLogProps {
  logs: LogEntry[];
}

export function EvaluationLog({ logs }: EvaluationLogProps) {
  if (logs.length === 0) return null;

  return (
    <Card className="p-6 border-border/50 mt-6">
      <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="text-lg">📋</span> Evaluation Log
      </h3>
      <ScrollArea className="h-64">
        <div className="space-y-4">
          {logs.map((log, i) => (
            <div key={i} className="border border-border rounded-lg p-4 text-xs font-mono">
              <div className="text-muted-foreground mb-2">{log.timestamp}</div>
              <div className="mb-2">
                <span className="text-primary font-semibold">Result:</span>{" "}
                <span className="text-foreground">{log.level} ({Math.round(log.confidence * 100)}%)</span>
              </div>
              <div className="mb-2">
                <span className="text-primary font-semibold">Preprocessing:</span>
                <ul className="ml-4 mt-1 space-y-0.5 text-muted-foreground">
                  {log.preprocessingSteps.map((step, j) => (
                    <li key={j}>→ {step}</li>
                  ))}
                </ul>
              </div>
              <details className="cursor-pointer">
                <summary className="text-primary font-semibold">Raw Model Output</summary>
                <pre className="mt-2 text-muted-foreground whitespace-pre-wrap break-words text-[11px] max-h-40 overflow-auto bg-muted p-2 rounded">
                  {log.rawModelOutput}
                </pre>
              </details>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
