// The message box with voice input (lazy chunk). One mic beside Send, one state strip inside the composer card.
// Engine: the server voice (Sarvam STT via /agent/voice/transcribe — better Hinglish, spoken answers) when
// /agent/voice/config says enabled; else the browser's free speech recognition (./../../lib/voice/webSpeech); else
// no mic at all (typing keeps working). Either way the recognised text lands in the box for review and is only sent
// when the user presses Send — never by itself. An unedited server transcript is sent as a voice turn, so the answer
// is also spoken (contract 1.5); an edited one goes out as a normal message.
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import { Check, Loader2, Mic, MicOff, Settings2, Square, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { AgentComposer } from "@/components/agent/AgentComposer";
import { agentStore } from "@/lib/agent/store";
import { speechLang, useAgentT } from "@/lib/agent/i18n";
import { useVoice } from "@/lib/voice/useVoice";
import { dictationSupported, useDictation } from "@/lib/voice/webSpeech";
import { usePreviewVoice } from "@/lib/voice/preview";
import { LevelMeter } from "./MicButton";
import { VoiceConsent } from "./VoiceConsent";
import { VoiceSettings } from "./VoiceSettings";

type Props = ComponentProps<typeof AgentComposer>;
type Phase = "idle" | "requesting" | "listening" | "processing" | "ready" | "speaking" | "error";
interface View { phase: Phase; message?: string; interim?: string; level?: number; icon?: "denied" | "network" }

/** "box text" + " " + "spoken text" — dictation appends to what is already typed. Pure. */
export function appendTranscript(current: string, spoken: string): string {
  const a = current.trim(), b = spoken.trim();
  return a ? (b ? `${a} ${b}` : a) : b;
}

export default function VoiceComposer(props: Props) {
  const { t, lang } = useAgentT();
  const v = useVoice(props.uid ?? null);
  const preview = usePreviewVoice();
  const [consent, setConsent] = useState(false);
  const [settings, setSettings] = useState(false);
  const server = !!v.config?.enabled && v.supported;
  const browser = useMemo(dictationSupported, []);
  const engine: "preview" | "server" | "browser" | "none" = preview ? (preview === "unsupported" ? "none" : "preview") : server ? "server" : browser ? "browser" : "none";

  const toBox = useCallback((text: string) => agentStore.prefill(appendTranscript(agentStore.composerText, text)), []);
  const dict = useDictation(speechLang(lang), toBox);

  // ---- one view model for every engine -------------------------------------------------------------------------
  const view: View = (() => {
    if (engine === "preview") {
      if (preview === "listening") return { phase: "listening", interim: "Meri classes ki is mahine ki attendance", level: 0.12 };
      if (preview === "processing") return { phase: "processing" };
      if (preview === "ready") return { phase: "ready" };
      if (preview === "denied") return { phase: "error", message: t("voice.denied"), icon: "denied" };
    }
    if (engine === "browser") {
      const d = dict.state;
      if (d === "requesting") return { phase: "requesting" };
      if (d === "listening") return { phase: "listening", interim: `${dict.text} ${dict.interim}`.trim() };
      if (d === "processing") return { phase: "processing" };
      if (d === "ready") return { phase: "ready" };
      if (d === "timeout") return { phase: "ready", message: `${t("voice.timeout")} ${t("voice.ready")}` };
      if (d === "denied") return { phase: "error", message: t("voice.denied"), icon: "denied" };
      if (d === "unsupported") return { phase: "error", message: t("voice.unsupported"), icon: "denied" };
      if (d === "network") return { phase: "error", message: t("voice.network"), icon: "network" };
      if (d === "nospeech") return { phase: "error", message: t("voice.noSpeech") };
    }
    if (engine === "server") {
      const st = v.session.state, n = v.session.notice;
      if (st === "listening") return { phase: "listening", level: v.session.level };
      if (st === "transcribing") return { phase: "processing" };
      if (st === "speaking") return { phase: "speaking", message: v.speech ?? undefined };
      if (n?.kind === "ready") return { phase: "ready" };
      if (n?.kind === "denied") return { phase: "error", message: t("voice.denied"), icon: "denied" };
      if (n?.kind === "unsupported") return { phase: "error", message: t("voice.unsupported"), icon: "denied" };
      if (n?.kind === "repeat") return { phase: "error", message: t("voice.noSpeech") };
      if (n?.kind === "network") return { phase: "error", message: t("voice.network"), icon: "network" };
      if (n?.kind === "limit") return { phase: "error", message: t("error.rate", { s: n.retryAt ? Math.max(1, Math.ceil((n.retryAt - Date.now()) / 1000)) : 30 }) };
      if (n?.kind === "down") return { phase: "error", message: t("error.unavailable") };
    }
    return { phase: "idle" };
  })();

  const dismiss = () => { dict.reset(); v.dismiss(); };
  const tapMic = () => {
    if (engine === "preview") return;
    if (engine === "browser") {
      if (dict.state === "listening" || dict.state === "requesting") dict.stop(); else dict.start();
      return;
    }
    if (v.needsConsent) { setConsent(true); return; } // asked only when the mic is tapped, never before
    v.tap();
  };
  const onSend = (text: string) => {
    dict.reset();
    if (engine === "server" && v.sendTranscript(text)) return;
    props.onSend(text);
  };

  const listening = view.phase === "listening" || view.phase === "requesting";
  const busyMic = view.phase === "processing";
  const mic = engine === "none" ? null : (
    <button type="button" onClick={tapMic} disabled={busyMic || props.offline || (props.busy && view.phase !== "speaking")}
      aria-label={listening ? t("voice.stop") : view.phase === "speaking" ? t("composer.stop") : t("voice.mic")} aria-pressed={listening}
      title={listening ? t("voice.stop") : t("voice.mic")} data-testid="mic-button" data-state={view.phase}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${listening
        ? "bg-destructive text-destructive-foreground" : "text-foreground hover:bg-muted"}`}>
      {listening ? <span aria-hidden="true" className="absolute inset-0 rounded-full bg-destructive/40 motion-safe:animate-ping" /> : null}
      {listening ? <Square aria-hidden="true" className="relative h-4 w-4" fill="currentColor" />
        : busyMic ? <Loader2 aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" />
        : view.phase === "speaking" ? <Volume2 aria-hidden="true" className="h-5 w-5 text-primary" />
        : <Mic aria-hidden="true" className="h-5 w-5" />}
    </button>
  );

  const closeBtn = (
    <button type="button" onClick={dismiss} aria-label={t("voice.dismiss")} className="-my-1 -mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  );
  const strip = view.phase === "idle" ? null : (
    <div className="flex items-start gap-2 border-b border-border/70 px-4 py-2 text-[13px]" data-testid="voice-strip" data-phase={view.phase}>
      {view.phase === "requesting" ? <><Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin text-muted-foreground" /><span className="text-muted-foreground">{t("voice.requesting")}</span></> : null}
      {view.phase === "listening" ? (
        <>
          <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-destructive dark:text-red-400">{t("voice.listening")}</span>
            {view.interim ? <span className="agent-prose mt-0.5 block text-foreground" data-testid="voice-interim">{view.interim}</span> : null}
          </span>
          {typeof view.level === "number" && !v.lite ? <span className="text-destructive dark:text-red-400"><LevelMeter level={view.level} /></span> : null}
        </>
      ) : null}
      {view.phase === "processing" ? <><Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin text-primary" /><span className="text-muted-foreground">{t("voice.processing")}</span></> : null}
      {view.phase === "ready" ? <><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="agent-prose min-w-0 flex-1 text-foreground">{view.message ?? t("voice.ready")}</span>{closeBtn}</> : null}
      {view.phase === "speaking" ? (
        <>
          <Volume2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="agent-prose min-w-0 flex-1 text-foreground">{view.message}</span>
          <button type="button" onClick={() => v.setPrefs({ muted: !v.prefs.muted })} aria-pressed={v.prefs.muted}
            aria-label={v.prefs.muted ? t("voice.unmute") : t("voice.mute")} className="-my-1 grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {v.prefs.muted ? <VolumeX aria-hidden="true" className="h-4 w-4" /> : <Volume2 aria-hidden="true" className="h-4 w-4" />}
          </button>
        </>
      ) : null}
      {view.phase === "error" ? (
        <>
          {view.icon === "network" ? <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <MicOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="agent-prose min-w-0 flex-1 text-foreground" data-testid="voice-error">{view.message}</span>{closeBtn}
        </>
      ) : null}
    </div>
  );

  // server clarify chips after a transcript ("Kaun sa ECE?"): an explicit tap, so sending is the user's choice
  const n = engine === "server" ? v.session.notice : null;
  const chips = n?.kind === "pick" ? (
    <div className="flex flex-wrap gap-2 border-b border-border/70 px-4 py-2" role="group" aria-label={n.question}>
      <span className="agent-prose w-full text-[13px] text-foreground"><q>{n.text}</q> — {n.question}</span>
      {n.chips.map((c) => (
        <button key={c.value} type="button" onClick={() => v.pick(c.value)} className="min-h-10 rounded-full border border-border px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{c.label}</button>
      ))}
      {closeBtn}
    </div>
  ) : null;

  return (
    <>
      {consent && v.needsConsent ? (
        <div className="mx-auto max-w-3xl px-3 pt-2">
          <VoiceConsent onAccept={() => { v.acceptConsent(); setConsent(false); requestAnimationFrame(() => v.tap()); }}
            onExample={(text) => { v.acceptConsent(); setConsent(false); toBox(text); }} />
        </div>
      ) : null}
      {settings && v.config ? <div className="mx-auto max-w-3xl px-3 pt-2"><VoiceSettings config={v.config} prefs={v.prefs} onChange={v.setPrefs} onClose={() => setSettings(false)} /></div> : null}
      <AgentComposer {...props} onSend={onSend} mic={mic} above={chips ?? strip}
        footerStart={engine === "server" ? (
          <button type="button" onClick={() => setSettings((x) => !x)} aria-expanded={settings} aria-label={t("voice.settings")} title={t("voice.settings")}
            className="-ml-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="voice-settings-toggle">
            <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null} />
      <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="voice-live">{engine === "server" && v.liveText ? v.liveText : view.message ?? (view.phase === "listening" ? t("voice.listening") : view.phase === "ready" ? t("voice.ready") : "")}</p>
    </>
  );
}
