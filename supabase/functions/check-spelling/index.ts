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
    const { text, misspelledWords } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Azyndan 3 simwol ýazyň." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Tekst 5000 simwoldan köp bolmaly däl." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const misspelledList = Array.isArray(misspelledWords) ? misspelledWords : [];

    const systemPrompt = `Sen türkmen diliniň orfografiýa barlagçysysyň. Ulanyjynyň teksti Hunspell sözlügi bilen öňünden barlandy. Sözlükde tapylmadyk sözler saňa iberildi.

Seniň wezipäň:
- Iberilen ýalňyş sözleri seret we dogry görnüşini tap
- Käbir sözler sözlükde bolmasa-da dogry bolup biler (at, ýer ady, täze söz) — olary ýalňyş diýme
- Her ýalňyş söz üçin dogry görnüşini we düşündirişini ber
- Eger ähli sözler dogry bolsa, boş "errors" massiw gaýtar

Türkmen elipbiýi: A, B, Ç, D, E, Ä, F, G, H, I, J, Ž, K, L, M, N, Ň, O, Ö, P, R, S, Ş, T, U, Ü, W, Y, Ý, Z

Diňe şu JSON formatynda jogap ber (markdown ýok, kod blogy ýok):
{
  "correctedText": "Doly düzedilen tekst",
  "errors": [
    {
      "original": "ýalňyş söz",
      "corrected": "dogry söz",
      "position": 0,
      "explanation": "Näme üçin ýalňyş we nädip düzedildi"
    }
  ],
  "summary": "Umumy baha — näçe ýalňyş tapyldy we nähili ýalňyşlyklar",
  "isCorrect": true/false
}`;

    const userMessage = `Tekst:\n"${text.trim()}"\n\nSözlükde tapylmadyk sözler: ${misspelledList.length > 0 ? misspelledList.join(", ") : "(ýok)"}`;

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
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Çäklendirme aşyldy. Biraz garaşyp synanyşyň." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Hyzmat kreditlary gutardy. Soňrak synanyşyň." }),
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
    console.error("check-spelling error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Barlag şowsuz boldy: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
