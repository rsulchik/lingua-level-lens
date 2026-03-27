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
    const { audioBase64, mimeType, assessLanguage } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: "Ses ýazgysy berilmedi." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a multilingual speech-to-text and language analysis expert with deep knowledge of the Turkmen language (Türkmen dili).

Your tasks:
1. Transcribe the audio accurately — pay special attention to Turkmen speech
2. Detect the language spoken
3. If the language is Turkmen, provide a detailed assessment of the speaker's Turkmen language proficiency
4. If it's English, assess the CEFR level
5. Provide a brief analysis

For Turkmen language assessment, evaluate:
- Pronunciation clarity and accent
- Vocabulary range (basic daily words vs literary/formal vocabulary)
- Grammar correctness (söz düzümi, hal goşulmalary, işlik çekimleri)
- Fluency and natural speech flow
- Assign a proficiency level: Başlangyç (Beginner), Orta (Intermediate), Ösen (Advanced), Ussatlyk (Mastery)

You MUST respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "transcription": "the transcribed text",
  "detectedLanguage": "language name in Turkmen (e.g. Türkmen, Iňlis, Rus)",
  "isTurkmen": boolean,
  "isEnglish": boolean,
  "proficiencyLevel": "for Turkmen: Başlangyç/Orta/Ösen/Ussatlyk, for English: A1-C2, or null",
  "proficiencyLabel": "human-readable label in Turkmen",
  "confidence": number 0-1,
  "analysis": "detailed analysis in Turkmen language about pronunciation, vocabulary, grammar, fluency",
  "grammarNotes": "specific grammar observations in Turkmen",
  "vocabularyNotes": "vocabulary range assessment in Turkmen",
  "pronunciationNotes": "pronunciation quality assessment in Turkmen",
  "suggestions": ["improvement suggestion in Turkmen 1", "suggestion 2", "suggestion 3"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe and analyze this audio recording. Pay special attention if the speaker is speaking Turkmen:" },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "audio/webm"};base64,${audioBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Çäklendirme aşyldy. Biraz garaşyň." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Hyzmat kreditlary gutardy." }),
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

    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(cleaned);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("transcribe-audio error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Ses seljermesi şowsuz: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
