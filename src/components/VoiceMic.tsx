"use client";

import { useState } from "react";

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  start: () => void;
};

/** English-only dictation for brief fields. */
export function VoiceMic({
  onText,
  compact = false,
}: {
  onText: (text: string) => void;
  compact?: boolean;
}) {
  const [on, setOn] = useState(false);
  const [heard, setHeard] = useState("");

  function start() {
    const Speech =
      (window as unknown as { SpeechRecognition?: SpeechCtor }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechCtor })
        .webkitSpeechRecognition;
    if (!Speech) {
      setHeard("Voice is not available in this browser. Type instead.");
      return;
    }
    const rec = new Speech();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setOn(true);
    rec.onend = () => setOn(false);
    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setHeard(text);
      onText(text);
    };
    rec.start();
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "gap-3"}`}>
      <button type="button" className="btn-secondary" onClick={start}>
        {on ? "Listening…" : compact ? "Mic" : "Mic"}
      </button>
      {heard ? <p className="text-sm text-[var(--muted)]">Heard: {heard}</p> : null}
    </div>
  );
}
