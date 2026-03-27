import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Please provide at least 10 characters of text to analyze." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Text must be under 5000 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert linguist and language assessment specialist. Your task is to analyze a text sample and determine the writer's CEFR (Common European Framework of Reference for Languages) proficiency level.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "confidence": number between 0 and 1,
  "detectedLanguage": "language name",
  "isEnglish": boolean,
  "explanation": "A detailed 2-3 sentence explanation of WHY this level was assigned, referencing specific features of the text like vocabulary complexity, grammatical structures, cohesion, discourse markers, etc.",
  "features": [
    "feature 1 observed in the text",
    "feature 2 observed in the text",
    "feature 3 observed in the text"
  ],
  "levelDescription": "Brief description of what this CEFR level means"
}

CEFR Level Guidelines:
- A1 (Beginner): Very basic phrases, simple present tense, limited vocabulary
- A2 (Elementary): Simple sentences about familiar topics, basic connectors (and, but, because)
- B1 (Intermediate): Connected text on familiar matters, can express opinions, uses some complex structures
- B2 (Upper-Intermediate): Clear detailed text, can argue for/against, good range of vocabulary, varied sentence structures
- C1 (Advanced): Well-structured complex text, flexible and effective language use, sophisticated vocabulary, nuanced expression
- C2 (Proficiency): Near-native fluency, precise and nuanced expression, complex argumentation, masterful use of idioms and register

Analyze vocabulary range, grammatical complexity, sentence structure variety, use of connectors/discourse markers, coherence, and sophistication of expression.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze the following text and determine the CEFR proficiency level of the writer:\n\n"${text.trim()}"` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service credits exhausted. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI model");
    }

    // Parse the JSON response, stripping any markdown fences
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(cleaned);

    return new Response(
      JSON.stringify({
        ...result,
        rawModelOutput: content,
        preprocessingSteps: [
          `Input text length: ${text.length} characters`,
          `Detected language: ${result.detectedLanguage || "English"}`,
          result.isEnglish === false
            ? "Non-English text detected — analyzed in original language"
            : "Text identified as English",
          "Sent to Lovable AI (Gemini) for CEFR classification",
          "Model analyzed vocabulary, grammar, coherence, and discourse features",
        ],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-text error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Analysis failed: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
