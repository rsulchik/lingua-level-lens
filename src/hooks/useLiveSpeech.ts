import { useCallback, useRef, useState } from "react";

const LOCALE_MAP: Record<string, string> = {
  tk: "tr-TR", // browsers have no Turkmen model; Turkish is the closest phonetically
  en: "en-US",
  ru: "ru-RU",
  tr: "tr-TR",
  auto: "tr-TR",
};

function getRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const liveSpeechSupported = () => getRecognitionCtor() !== null;

export function useLiveSpeech() {
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isActive, setIsActive] = useState(false);
  const recRef = useRef<any>(null);
  const manualStopRef = useRef(false);
  const finalRef = useRef("");

  const start = useCallback((language: string) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    finalRef.current = "";
    setFinalText("");
    setInterimText("");
    manualStopRef.current = false;

    const rec = new Ctor();
    rec.lang = LOCALE_MAP[language] ?? "tr-TR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) {
          finalRef.current = (finalRef.current + " " + text).trim();
        } else {
          interim += text;
        }
      }
      setFinalText(finalRef.current);
      setInterimText(interim.trim());
    };

    rec.onerror = () => {
      setInterimText("");
    };

    rec.onend = () => {
      // Chrome stops after silence; restart while the user is still recording.
      if (!manualStopRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* ignore */
        }
      }
      setIsActive(false);
    };

    try {
      rec.start();
    } catch {
      return false;
    }
    recRef.current = rec;
    setIsActive(true);
    return true;
  }, []);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
    setIsActive(false);
    setInterimText("");
    return finalRef.current.trim();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setFinalText("");
    setInterimText("");
  }, []);

  return { finalText, interimText, isActive, start, stop, reset };
}
