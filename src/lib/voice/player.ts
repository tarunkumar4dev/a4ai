// Plays one spoken sentence: TTS audio (Blob → <audio>) or, on a slow network / when the server has no TTS,
// the browser's speechSynthesis. One player at a time; `stop()` cuts whatever is playing (tapping the mic).
export interface Player {
  /** resolves when playback ends or is stopped; never rejects */
  play(src: Blob | { synth: string; lang: string; rate: number }): Promise<void>;
  stop(): void;
  readonly playing: boolean;
}

export function synthSupported(w: { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown } = window as never): boolean {
  return typeof w.speechSynthesis === "object" && typeof w.SpeechSynthesisUtterance === "function";
}

/** speechSynthesis lang tag from the agent's language code. Pure. */
export const synthLang = (language: string): string => (language === "en" ? "en-IN" : "hi-IN");

export function createPlayer(): Player {
  let audio: HTMLAudioElement | null = null;
  let url: string | null = null;
  let utter: SpeechSynthesisUtterance | null = null;
  let done: (() => void) | null = null;
  let playing = false;

  const finish = () => {
    playing = false;
    if (audio) { audio.onended = audio.onerror = null; try { audio.pause(); } catch { /* ignore */ } audio = null; }
    if (url) { URL.revokeObjectURL(url); url = null; }
    if (utter) { utter.onend = utter.onerror = null; utter = null; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }
    const d = done; done = null; d?.();
  };

  return {
    get playing() { return playing; },
    stop: finish,
    play(src) {
      finish();
      playing = true;
      return new Promise<void>((resolve) => {
        done = resolve;
        if (src instanceof Blob) {
          url = URL.createObjectURL(src);
          audio = new Audio(url);
          audio.preload = "auto";
          audio.onended = finish;
          audio.onerror = finish;
          audio.play().catch(finish); // autoplay blocked (no gesture yet) → caption only
          return;
        }
        if (!synthSupported()) { finish(); return; }
        try {
          utter = new SpeechSynthesisUtterance(src.synth);
          utter.lang = src.lang;
          utter.rate = src.rate;
          utter.onend = finish;
          utter.onerror = finish;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        } catch { finish(); }
      });
    },
  };
}
