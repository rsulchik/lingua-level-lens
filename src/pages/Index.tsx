import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CEFRResult } from "@/components/CEFRResult";
import { EvaluationLog } from "@/components/EvaluationLog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Languages, Send } from "lucide-react";

interface AnalysisResult {
  level: string;
  confidence: number;
  explanation: string;
  features: string[];
  levelDescription: string;
  detectedLanguage: string;
  isEnglish: boolean;
  rawModelOutput: string;
  preprocessingSteps: string[];
}

interface LogEntry {
  timestamp: string;
  preprocessingSteps: string[];
  rawModelOutput: string;
  level: string;
  confidence: number;
}

const SAMPLE_TEXTS: Record<string, { label: string; text: string }> = {
  a1: { label: "A1 Sample", text: "I like cats. My cat is big. I go to school every day. I eat breakfast in the morning." },
  b1: { label: "B1 Sample", text: "I believe that learning a new language is one of the most rewarding experiences a person can have. Although it takes time and dedication, the ability to communicate with people from different cultures is incredibly valuable." },
  c1: { label: "C1 Sample", text: "The proliferation of artificial intelligence across various sectors has engendered both unprecedented opportunities and formidable ethical challenges. While proponents argue that AI-driven automation will catalyze economic growth and alleviate mundane labor, critics contend that the displacement of human workers necessitates comprehensive policy frameworks to mitigate socioeconomic disparities." },
};

export default function Index() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleAnalyze = async () => {
    if (text.trim().length < 10) {
      toast.error("Please enter at least 10 characters.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-text", {
        body: { text: text.trim() },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);

      const logEntry: LogEntry = {
        timestamp: new Date().toLocaleString(),
        preprocessingSteps: data.preprocessingSteps || [],
        rawModelOutput: data.rawModelOutput || "",
        level: data.level,
        confidence: data.confidence,
      };
      setLogs((prev) => [logEntry, ...prev]);

      console.log("=== CEFR Evaluation Log ===");
      console.log("Timestamp:", logEntry.timestamp);
      console.log("Level:", data.level, `(${Math.round(data.confidence * 100)}%)`);
      console.log("Preprocessing:", data.preprocessingSteps);
      console.log("Raw output:", data.rawModelOutput);

      toast.success(`Analysis complete: ${data.level}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      toast.error(message);
      console.error("Analysis error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Languages className="h-10 w-10 text-primary-foreground" />
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-primary-foreground">
              LinguaTech
            </h1>
          </div>
          <p className="text-primary-foreground/80 text-lg font-body max-w-xl mx-auto">
            AI-powered language proficiency assessment using the CEFR scale.
            Paste any text and get an instant evaluation.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Input Section */}
        <Card className="p-6 border-border/50 shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-2">
            Enter or paste your text sample
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write or paste a text sample here (minimum 10 characters)..."
            className="min-h-[160px] resize-y text-base bg-background border-input focus:ring-ring"
            maxLength={5000}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{text.length} / 5000</span>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(SAMPLE_TEXTS).map(([key, sample]) => (
                <button
                  key={key}
                  onClick={() => setText(sample.text)}
                  className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={isLoading || text.trim().length < 10}
            className="w-full mt-4 h-12 text-base font-heading font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Assess Proficiency
              </>
            )}
          </Button>
        </Card>

        {/* Results */}
        {result && <CEFRResult result={result} />}

        {/* Log */}
        <EvaluationLog logs={logs} />

        {/* Info Footer */}
        <div className="text-center text-xs text-muted-foreground py-6 space-y-1">
          <p>Powered by Lovable AI (Gemini) · CEFR Classification</p>
          <p>This tool provides an AI-based estimate. For official certification, consult accredited testing centers.</p>
        </div>
      </main>
    </div>
  );
}
