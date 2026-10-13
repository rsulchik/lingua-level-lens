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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sttData = await sttRes.json();
    const transcription: string = (sttData.text ?? "").trim();

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "Ses ýazgysynda söz tapylmady. Has ýokary sesde gepläp synanyşyň." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Step 2: language + proficiency analysis on the transcript ----
    const systemPrompt = `You are an expert linguist specializing in the Turkmen language (Türkmen dili) and CEFR assessment.

You receive a raw machine transcript of spoken audio. Speech recognition is weak for Turkmen: it often outputs Turkish, Azerbaijani, Uzbek or Russian-like spellings, or mishears words.
Task 0: If the speech is Turkmen (or the user selected Turkmen), rewrite the transcript into correct modern Turkmen Latin orthography (letters ä, ç, ň, ö, ş, ü, ý, ž). Keep meaning and word order; do not add content. Put it in "correctedTranscription". For other languages, return the transcript with only obvious recognition fixes.

Typical STT errors for Turkmen (Turkish/Azerbaijani leakage) — fix them:
- Pronouns: ben→men, sen→sen, o→ol, biz→biz, onlar→olar, bana→maňa, sana→saňa, benim→meniň, senin→seniň, onun→onuň, bunu→muny, şunu→şuny
- Common words: değil→däl, var→bar, yok→ýok, evet→hawa, hayır→ýok, çok→köp/örän, güzel→gowy/owadan, okul→mekdep, ev→öý, su→suw, gün→gün, bugün→şu gün, yarın→ertir, dün→düýn, şimdi→häzir, ne→näme, nasıl→nähili, nerede→nirede, neden/niye→näme üçin, ama→emma, ile→bilen, için→üçin, gibi→ýaly, kadar→çenli, sonra→soň, önce→öň, büyük→uly, küçük→kiçi, iyi→gowy, kötü→erbet, zaman→wagt, kitap→kitap, arkadaş→dost/ýoldaş, anne→eje, baba→kaka, kardeş→dogan, teşekkür ederim→sag boluň, merhaba→salam
- Verbs: gidiyorum→gidýärin/barýaryn, geliyorum→gelýärin, yapıyorum→edýärin, istiyorum→isleýärin, biliyorum→bilýärin, -yor-→-ýar/-ýär, -acak/-ecek→-jak/-jek, -mış→-ypdyr/-ipdir, -dı/-di→-dy/-di, olmak→bolmak, vermek→bermek, yapmak→etmek, söylemek→aýtmak, konuşmak→gürlemek
- Letters: ı→y, ğ→g (or drop), y- at word start often → ý (yol→ýol, yaz→ýaz, yer→ýer), c→j (cevap→jogap, can→jan), initial v→w (var→bar, ver→ber, vatan→watan), w for Russian/Arabic v (Ashgabat→Aşgabat), nasal n before g/k → ň (şunuň, meniň), long ä (gelýär, edýär), ö/ü kept
- Case endings: genitive -ın/-in→-yň/-iň, dative -a/-e kept or -a/-e after consonant, -ya/-ye → -a/-e, accusative -ı/-i→-y/-i, locative -da/-de kept, ablative -dan/-den kept
- Russian loanwords keep Turkmen spelling: kompýuter, internet, telefon, uniwersitet, institut
Every corrected word must be a real Turkmen word form.
Then:
1. Detect the spoken language.
2. If Turkmen: assess proficiency — vocabulary range, grammar (söz düzümi, hal goşulmalary, işlik çekimleri), fluency, register. Level: Başlangyç / Orta / Ösen / Ussatlyk.
3. If English: assign a CEFR level A1–C2.
4. Other languages: describe the level in Turkmen, proficiencyLevel may be null.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "correctedTranscription": "cleaned transcript",
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

    const hint = language === "tk" ? "The user stated the recording is in Turkmen." : "";
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: systemPrompt,
        input: `${hint}\nTranscript:\n"""${transcription}"""`,
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
    const outText: string = aiData.output_text ??
      (aiData.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("");
    let cleaned = (outText ?? "").trim();
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
      JSON.stringify({
        ...analysis,
        rawTranscription: transcription,
        transcription: (typeof analysis.correctedTranscription === "string" && analysis.correctedTranscription.trim()) || transcription,
      }),
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
