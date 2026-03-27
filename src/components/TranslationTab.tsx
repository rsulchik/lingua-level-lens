import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Copy } from "lucide-react";

const LANGUAGES = [
  { value: "Turkmen", label: "Türkmen" },
  { value: "English", label: "Iňlis" },
  { value: "Russian", label: "Rus" },
  { value: "Turkish", label: "Türk" },
  { value: "German", label: "Nemes" },
  { value: "French", label: "Fransuz" },
  { value: "Spanish", label: "Ispan" },
  { value: "Chinese", label: "Hytaý" },
  { value: "Arabic", label: "Arap" },
  { value: "Japanese", label: "Ýapon" },
  { value: "Korean", label: "Koreý" },
];

interface TranslationResult {
  translatedText: string;
  detectedSourceLang: string;
  targetLang: string;
  notes: string;
}

export function TranslationTab() {
  const [text, setText] = useState("");
  const [sourceLang, setSourceLang] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTranslate = async () => {
    if (text.trim().length < 2) {
      toast.error("Azyndan 2 simwol ýazyň.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { text: text.trim(), sourceLang, targetLang },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast.success("Terjime tamamlandy!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjime şowsuz boldy";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    if (result) {
      setText(result.translatedText);
      setResult(null);
    }
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp || "Turkmen");
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.translatedText);
      toast.success("Göçürildi!");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Awtomatik" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={handleSwap} className="shrink-0">
            <ArrowRightLeft className="h-4 w-4" />
          </Button>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Terjime etmek üçin tekst ýazyň..."
          className="min-h-[140px] resize-y text-base bg-background border-input"
          maxLength={5000}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{text.length} / 5000</span>
        </div>

        <Button
          onClick={handleTranslate}
          disabled={isLoading || text.trim().length < 2}
          className="w-full mt-4 h-12 text-base font-heading font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Terjime edilýär...
            </>
          ) : (
            <>
              <ArrowRightLeft className="mr-2 h-5 w-5" />
              Terjime et
            </>
          )}
        </Button>
      </Card>

      {result && (
        <Card className="p-6 border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <span className="text-lg">📝</span> Terjime netijesi
            </h3>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" /> Göçür
            </Button>
          </div>
          <p className="text-foreground leading-relaxed text-base mb-4 bg-muted p-4 rounded-lg">
            {result.translatedText}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Çeşme dili: {result.detectedSourceLang}</span>
            <span>•</span>
            <span>Maksat dili: {result.targetLang}</span>
          </div>
          {result.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">{result.notes}</p>
          )}
        </Card>
      )}
    </div>
  );
}
