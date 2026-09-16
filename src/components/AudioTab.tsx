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
  isTurkmen: boolean;
  isEnglish: boolean;
  proficiencyLevel: string | null;
  proficiencyLabel: string | null;
  confidence: number;
  analysis: string;
  grammarNotes?: string;
  vocabularyNotes?: string;
  pronunciationNotes?: string;
  suggestions: string[];
}

const TARGET_RATE = 16000;

function downsample(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate <= TARGET_RATE) return input;
  const ratio = inputRate / TARGET_RATE;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const samples = downsample(merged, inputRate);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function AudioTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AudioResult | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const recordingRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    source: MediaStreamAudioSourceNode;
    node: ScriptProcessorNode;
    pcm: Float32Array[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const pcm: Float32Array[] = [];
      node.onaudioprocess = (e) => {
        pcm.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);

      recordingRef.current = { stream, ctx, source, node, pcm };
      setAudioBlob(null);
      setIsRecording(true);
      toast.info("Ýazgy başlandy...");
    } catch (err) {
      toast.error("Mikrofona rugsat berilmedi.");
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    setIsRecording(false);

    rec.stream.getTracks().forEach((t) => t.stop());
    rec.node.disconnect();
    rec.source.disconnect();
    const sampleRate = rec.ctx.sampleRate;
    await rec.ctx.close();

    const blob = encodeWav(rec.pcm, sampleRate);
    if (blob.size < 4096) {
      toast.error("Ýazgy boş boldy — täzeden synanyşyň.");
      return;
    }
    setAudioBlob(blob);
    toast.success("Ýazgy tamamlandy!");
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
    "Başlangyç": "bg-cefr-a1",
    "Orta": "bg-cefr-b1",
    "Ösen": "bg-cefr-c1",
    "Ussatlyk": "bg-cefr-c2",
    A1: "bg-cefr-a1", A2: "bg-cefr-a2", B1: "bg-cefr-b1",
    B2: "bg-cefr-b2", C1: "bg-cefr-c1", C2: "bg-cefr-c2",
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 shadow-sm">
        <p className="text-sm text-muted-foreground mb-4">
          Türkmen ýa-da iňlis dilinde ses ýazgysyny ýazdyryň. AI sesiňizi tanap, dil derejesini kesgitlär.
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

      {result && <AudioResultDisplay result={result} levelColors={levelColors} />}
    </div>
  );
}

function AudioResultDisplay({ result, levelColors }: { result: AudioResult; levelColors: Record<string, string> }) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Transcription */}
      <Card className="p-6 border-border/50">
        <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="text-lg">🎤</span> Transkripsion
        </h3>
        <p className="text-foreground leading-relaxed bg-muted p-4 rounded-lg">
          {result.transcription}
        </p>
        <div className="flex gap-2 mt-3">
          <Badge variant="secondary">{result.detectedLanguage}</Badge>
          {result.isTurkmen && <Badge className="bg-primary text-primary-foreground">Türkmen dili</Badge>}
        </div>
      </Card>

      {/* Proficiency Level */}
      {result.proficiencyLevel && (
        <Card className="p-6 border-border/50 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {result.isTurkmen ? "Türkmen dili derejesi" : "CEFR Derejesi"}
          </p>
          <span className={`${levelColors[result.proficiencyLevel] || "bg-primary"} text-primary-foreground text-3xl font-heading font-bold px-5 py-2 rounded-xl inline-block`}>
            {result.proficiencyLevel}
          </span>
          {result.proficiencyLabel && (
            <p className="text-muted-foreground mt-2 text-sm">{result.proficiencyLabel}</p>
          )}
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

      {/* Detailed Analysis */}
      <Card className="p-6 border-border/50">
        <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="text-lg">🔍</span> Seljerme
        </h3>
        <p className="text-muted-foreground leading-relaxed">{result.analysis}</p>
      </Card>

      {/* Turkmen-specific assessments */}
      {result.isTurkmen && (
        <>
          {result.grammarNotes && (
            <Card className="p-6 border-border/50">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-lg">📝</span> Grammatika seljermesi
              </h3>
              <p className="text-muted-foreground leading-relaxed">{result.grammarNotes}</p>
            </Card>
          )}

          {result.vocabularyNotes && (
            <Card className="p-6 border-border/50">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-lg">📚</span> Söz baýlygy
              </h3>
              <p className="text-muted-foreground leading-relaxed">{result.vocabularyNotes}</p>
            </Card>
          )}

          {result.pronunciationNotes && (
            <Card className="p-6 border-border/50">
              <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-lg">🗣️</span> Aýdylyş seljermesi
              </h3>
              <p className="text-muted-foreground leading-relaxed">{result.pronunciationNotes}</p>
            </Card>
          )}
        </>
      )}

      {/* Suggestions */}
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
  );
}
