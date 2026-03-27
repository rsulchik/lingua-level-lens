import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mic, MicOff, Upload } from "lucide-react";

interface AudioResult {
  transcription: string;
  detectedLanguage: string;
  isEnglish: boolean;
  cefrLevel: string | null;
  confidence: number;
  analysis: string;
  suggestions: string[];
}

export function AudioTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AudioResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Ýazgy başlandy...");
    } catch (err) {
      toast.error("Mikrofona rugsat berilmedi.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Ýazgy tamamlandy!");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Faýl 10MB-dan uly bolmaly däl.");
        return;
      }
      setAudioBlob(file);
      toast.success(`Faýl ýüklendi: ${file.name}`);
    }
  };

  const handleAnalyze = async () => {
    if (!audioBlob) {
      toast.error("Ilki ses ýazgysyny ýazgy ediň ýa-da ýükläň.");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audioBase64: base64, mimeType: audioBlob.type || "audio/webm" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast.success("Ses seljermesi tamamlandy!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Seljerme şowsuz boldy";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const levelColors: Record<string, string> = {
    A1: "bg-cefr-a1", A2: "bg-cefr-a2", B1: "bg-cefr-b1",
    B2: "bg-cefr-b2", C1: "bg-cefr-c1", C2: "bg-cefr-c2",
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 shadow-sm">
        <p className="text-sm text-muted-foreground mb-4">
          Ses ýazgysyny ýazdyryň ýa-da ses faýlyny ýükläň. AI tekste öwrüp, dil derejesini kesgitlär.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? "destructive" : "default"}
            className="flex-1 h-14 text-base font-heading font-semibold"
            disabled={isLoading}
          >
            {isRecording ? (
              <>
                <MicOff className="mr-2 h-5 w-5" />
                Ýazgyny bes et
              </>
            ) : (
              <>
                <Mic className="mr-2 h-5 w-5" />
                Ses ýazdyr
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-14 text-base font-heading"
            disabled={isLoading || isRecording}
          >
            <Upload className="mr-2 h-5 w-5" />
            Faýl ýükle
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {audioBlob && !isRecording && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>✅ Ses ýazgysy taýýar</span>
              <span>({(audioBlob.size / 1024).toFixed(1)} KB)</span>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="w-full h-12 text-base font-heading font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Seljerilýär...
                </>
              ) : (
                "Sesi seljer"
              )}
            </Button>
          </div>
        )}
      </Card>

      {result && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="p-6 border-border/50">
            <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🎤</span> Transkripsion
            </h3>
            <p className="text-foreground leading-relaxed bg-muted p-4 rounded-lg">
              {result.transcription}
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary">{result.detectedLanguage}</Badge>
            </div>
          </Card>

          {result.cefrLevel && (
            <Card className="p-6 border-border/50 text-center">
              <p className="text-sm text-muted-foreground mb-2">CEFR Derejesi</p>
              <span className={`${levelColors[result.cefrLevel] || "bg-primary"} text-primary-foreground text-3xl font-heading font-bold px-5 py-2 rounded-xl inline-block`}>
                {result.cefrLevel}
              </span>
              {result.confidence > 0 && (
                <div className="mt-4 max-w-xs mx-auto">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Ynam</span>
                    <span className="font-heading font-bold text-primary">{Math.round(result.confidence * 100)}%</span>
                  </div>
                  <Progress value={result.confidence * 100} className="h-2" />
                </div>
              )}
            </Card>
          )}

          <Card className="p-6 border-border/50">
            <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🔍</span> Seljerme
            </h3>
            <p className="text-muted-foreground leading-relaxed">{result.analysis}</p>
          </Card>

          {result.suggestions && result.suggestions.length > 0 && (
            <Card className="p-6 border-border/50">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-lg">💡</span> Teklipler
              </h3>
              <ul className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-accent mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
