import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface CEFRResultProps {
  result: {
    level: string;
    confidence: number;
    explanation: string;
    features: string[];
    levelDescription: string;
    detectedLanguage: string;
    isEnglish: boolean;
  };
}

const levelColors: Record<string, string> = {
  A1: "bg-cefr-a1",
  A2: "bg-cefr-a2",
  B1: "bg-cefr-b1",
  B2: "bg-cefr-b2",
  C1: "bg-cefr-c1",
  C2: "bg-cefr-c2",
};

const levelLabels: Record<string, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-Intermediate",
  C1: "Advanced",
  C2: "Proficiency",
};

export function CEFRResult({ result }: CEFRResultProps) {
  const confidencePercent = Math.round(result.confidence * 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Level Badge */}
      <Card className="p-8 text-center gradient-card border-border/50 shadow-lg">
        <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Predicted CEFR Level
        </p>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span
            className={`${levelColors[result.level] || "bg-primary"} text-primary-foreground text-4xl font-heading font-bold px-6 py-3 rounded-xl shadow-md`}
          >
            {result.level}
          </span>
          <span className="text-xl font-heading text-foreground">
            {levelLabels[result.level] || result.level}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{result.levelDescription}</p>

        {!result.isEnglish && (
          <Badge variant="secondary" className="mt-3">
            Language detected: {result.detectedLanguage}
          </Badge>
        )}
      </Card>

      {/* Confidence Score */}
      <Card className="p-6 border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Confidence Score</span>
          <span className="text-sm font-heading font-bold text-primary">{confidencePercent}%</span>
        </div>
        <Progress value={confidencePercent} className="h-3" />
      </Card>

      {/* Explanation */}
      <Card className="p-6 border-border/50">
        <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="text-lg">🔍</span> Analysis Explanation
        </h3>
        <p className="text-muted-foreground leading-relaxed">{result.explanation}</p>
      </Card>

      {/* Key Features */}
      <Card className="p-6 border-border/50">
        <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="text-lg">✨</span> Key Features Detected
        </h3>
        <ul className="space-y-2">
          {result.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-muted-foreground">
              <span className="text-accent mt-0.5">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
