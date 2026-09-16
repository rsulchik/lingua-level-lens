import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extFor(mimeType: string): string {
  const base = (mimeType || "").split(";")[0].trim();
  const map: Record<string, string> = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/flac": "flac",
  };
  return map[base] ?? "wav";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, mimeType, language } = await req.json();

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

    const bytes = base64ToBytes(audioBase64);
    if (bytes.length < 2048) {
      return new Response(
        JSON.stringify({ error: "Ses ýazgysy gaty gysga ýa-da boş. Täzeden synanyşyň." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Step 1: dedicated speech-to-text model ----
    const ext = extFor(mimeType);
    const form = new FormData();
    form.append("model", "google/gemini-3.5-transcribe");
    form.append(
      "file",
      new Blob([bytes], { type: (mimeType || "audio/wav").split(";")[0] }),
      `recording.${ext}`
    );
    const allowedLangs = ["tk", "en", "ru", "tr"];
    if (typeof language === "string" && allowedLangs.includes(language)) {
      form.append("language", language);
    }

    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });

    if (!sttRes.ok) {
      const status = sttRes.status;
      const errText = await sttRes.text().catch(() => "");
      console.error("STT error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Çäklendirme aşyldy. Biraz garaşyň." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Hyzmat kreditlary gutardy." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: "Ses tanalmady. Başga formatda ýa-da has arassa ýazgy bilen synanyşyň." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sttData = await sttRes.json();
    const transcription: string = (sttData.text ?? "").trim();

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "Ses ýazgysynda söz tapylmady. Has ýokary sesde gepläp synanyşyň." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Step 2: language + proficiency analysis on the transcript ----
    const systemPrompt = `You are an expert linguist specializing in the Turkmen language (Türkmen dili) and CEFR assessment.

You receive a transcript of spoken audio. Tasks:
1. Detect the spoken language.
2. If Turkmen: assess proficiency — vocabulary range, grammar (söz düzümi, hal goşulmalary, işlik çekimleri), fluency, register. Level: Başlangyç / Orta / Ösen / Ussatlyk.
3. If English: assign a CEFR level A1–C2.
4. Other languages: describe the level in Turkmen, proficiencyLevel may be null.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "detectedLanguage": "language name in Turkmen (Türkmen, Iňlis, Rus, ...)",
  "isTurkmen": boolean,
  "isEnglish": boolean,
  "proficiencyLevel": "Başlangyç/Orta/Ösen/Ussatlyk or A1-C2 or null",
  "proficiencyLabel": "human-readable label in Turkmen",
  "confidence": number 0-1,
  "analysis": "detailed analysis in Turkmen",
  "grammarNotes": "grammar observations in Turkmen",
  "vocabularyNotes": "vocabulary assessment in Turkmen",
  "pronunciationNotes": "notes in Turkmen based on transcript quality, hesitations, fillers",
  "suggestions": ["teklip 1", "teklip 2", "teklip 3"]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcript:\n"""${transcription}"""` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("AI gateway error:", aiRes.status, errText);
      // Transcription still succeeded — return it without assessment.
      return new Response(
        JSON.stringify({
          transcription,
          detectedLanguage: "Näbelli",
          isTurkmen: false,
          isEnglish: false,
          proficiencyLevel: null,
          proficiencyLabel: null,
          confidence: 0,
          analysis: "Ses tanaldy, ýöne dil derejesi seljerilip bilinmedi.",
          suggestions: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    let cleaned = (aiData.choices?.[0]?.message?.content ?? "").trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let analysis: Record<string, unknown> = {};
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = {
        detectedLanguage: "Näbelli",
        isTurkmen: false,
        isEnglish: false,
        proficiencyLevel: null,
        proficiencyLabel: null,
        confidence: 0,
        analysis: cleaned || "Seljerme elýeterli däl.",
        suggestions: [],
      };
    }

    return new Response(
      JSON.stringify({ ...analysis, transcription }),
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
