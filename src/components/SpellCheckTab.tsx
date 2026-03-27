import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Send, Sparkles } from "lucide-react";

interface SpellingError {
  original: string;
  corrected: string;
  position: number;
  explanation: string;
}

interface SpellCheckResult {
  correctedText: string;
  errors: SpellingError[];
  summary: string;
  isCorrect: boolean;
}

export function SpellCheckTab() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SpellCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheck = async () => {
    if (text.trim().length < 3) {
      toast.error("Azyndan 3 simwol ýazyň.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("check-spelling", {
        body: { text: text.trim() },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);

      if (data.isCorrect) {
        toast.success("Tekst dogry ýazylan! ✅");
      } else {
        toast.info(`${data.errors?.length || 0} ýalňyşlyk tapyldy`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Barlag şowsuz boldy";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const applyCorrectedText = () => {
    if (result?.correctedText) {
      setText(result.correctedText);
      setResult(null);
      toast.success("Düzedilen tekst goýuldy!");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 shadow-sm">
        <label className="block text-sm font-medium text-foreground mb-2">
          Türkmen dilinde tekst ýazyň
        </label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bu ýere türkmen dilinde tekst ýazyň..."
          className="min-h-[160px] resize-y text-base bg-background border-input focus:ring-ring"
          maxLength={5000}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{text.length} / 5000</span>
        </div>
        <Button
          onClick={handleCheck}
          disabled={isLoading || text.trim().length < 3}
          className="w-full mt-4 h-12 text-base font-heading font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Barlanylýar...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              Orfografiýany barla
            </>
          )}
        </Button>
      </Card>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Status */}
          <Card className="p-6 border-border/50 text-center">
            {result.isCorrect ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-lg font-heading font-semibold text-foreground">
                  Tekst dogry ýazylan!
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <p className="text-lg font-heading font-semibold text-foreground">
                  {result.errors.length} ýalňyşlyk tapyldy
                </p>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
            )}
          </Card>

          {/* Errors list */}
          {result.errors.length > 0 && (
            <Card className="p-6 border-border/50">
              <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="text-lg">🔍</span> Tapylan ýalňyşlyklar
              </h3>
              <div className="space-y-3">
                {result.errors.map((err, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="destructive" className="font-mono">
                        {err.original}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge className="bg-green-500/10 text-green-700 border-green-500/20 font-mono">
                        {err.corrected}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{err.explanation}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Corrected text */}
          {!result.isCorrect && result.correctedText && (
            <Card className="p-6 border-border/50">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-lg">✨</span> Düzedilen tekst
              </h3>
              <p className="text-foreground bg-muted/50 p-4 rounded-lg leading-relaxed whitespace-pre-wrap">
                {result.correctedText}
              </p>
              <Button
                onClick={applyCorrectedText}
                variant="outline"
                className="mt-3 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Düzedilen teksti ulan
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
