import { ArrowLeft, ArrowLeftRight, Mic, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useDevices } from "@/hooks/use-devices";
import { useToast } from "@/hooks/use-toast";
import { useTranslationStream } from "@/hooks/use-translation-stream";
import { useCreateTranslation } from "@/hooks/use-translations";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

const LANGUAGES: { name: string; flag: string }[] = [
  { name: "English",    flag: "🇬🇧" },
  { name: "Japanese",   flag: "🇯🇵" },
  { name: "Spanish",    flag: "🇪🇸" },
  { name: "French",     flag: "🇫🇷" },
  { name: "German",     flag: "🇩🇪" },
  { name: "Chinese",    flag: "🇨🇳" },
  { name: "Korean",     flag: "🇰🇷" },
  { name: "Italian",    flag: "🇮🇹" },
  { name: "Portuguese", flag: "🇧🇷" },
  { name: "Arabic",     flag: "🇸🇦" },
  { name: "Hindi",      flag: "🇮🇳" },
  { name: "Russian",    flag: "🇷🇺" },
  { name: "Dutch",      flag: "🇳🇱" },
  { name: "Turkish",    flag: "🇹🇷" },
  { name: "Polish",     flag: "🇵🇱" },
  { name: "Swedish",    flag: "🇸🇪" },
];

function getLangFlag(name: string) {
  return LANGUAGES.find(l => l.name === name)?.flag ?? "🌐";
}

interface Message {
  id: string;
  sourceLang: string;
  sourceText: string;
  targetLang: string;
  translatedText: string;
  timestamp: Date;
}

/* ── Waveform ── */
function WaveformBars({ data }: { data: number[] }) {
  const bars = data.length > 0 ? data.slice(-28) : Array(28).fill(0);
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {bars.map((v, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-75"
          style={{
            width: 3,
            height: v > 0 ? `${Math.max(4, v * 40)}px` : 4,
            background: v > 0 ? `rgba(255,255,255,${0.4 + v * 0.6})` : "rgba(255,255,255,0.12)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Message bubble ── */
function MessageBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col gap-2 py-4 border-b border-white/[0.05] last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-base">{getLangFlag(msg.sourceLang)}</span>
        <span className="text-xs font-medium text-white/30 uppercase tracking-widest">{msg.sourceLang}</span>
        <div className="flex-1 h-px bg-white/[0.05]" />
        <span className="text-[10px] text-white/15">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-white/50 text-sm leading-relaxed pl-7">{msg.sourceText}</p>

      <div className="flex items-start gap-2 mt-0.5 pl-7">
        <span className="text-base flex-shrink-0">{getLangFlag(msg.targetLang)}</span>
        <p className="text-white text-[15px] font-medium leading-relaxed">
          {msg.translatedText
            ? msg.translatedText
            : <span className="inline-block w-20 h-4 bg-white/10 rounded-md animate-pulse align-middle" />
          }
        </p>
      </div>
    </div>
  );
}

/* ── Language Card ── */
function LangCard({
  label, lang, onLangChange, mic, onMicChange, speaker, onSpeakerChange, mics, speakers,
  highlight,
}: {
  label: "A" | "B"; lang: string; onLangChange: (v: string) => void;
  mic: string; onMicChange: (v: string) => void;
  speaker: string; onSpeakerChange: (v: string) => void;
  mics: MediaDeviceInfo[]; speakers: MediaDeviceInfo[];
  highlight?: boolean;
}) {
  const flag = getLangFlag(lang);
  return (
    <div className={`
      flex-1 flex flex-col gap-3 rounded-2xl p-4 border transition-all duration-300
      ${highlight
        ? "bg-white/[0.07] border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        : "bg-white/[0.03] border-white/[0.07]"
      }
    `}>
      {/* Label badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.15em]">Person {label}</span>
        {highlight && (
          <span className="text-[10px] text-emerald-400/70 uppercase tracking-widest">Speaking</span>
        )}
      </div>

      {/* Flag + Language selector */}
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{flag}</span>
        <div className="relative flex-1">
          <select
            value={lang}
            onChange={e => onLangChange(e.target.value)}
            className="w-full bg-transparent text-white font-semibold text-base outline-none cursor-pointer appearance-none pr-5 [&>option]:bg-zinc-900 [&>option]:text-white"
            data-testid={`select-lang-${label.toLowerCase()}`}
          >
            {LANGUAGES.map(l => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06]" />

      {/* Device pickers */}
      <div className="flex flex-col gap-2">
        {/* Mic */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Mic className="w-3 h-3 text-white/40" />
          </div>
          <div className="relative flex-1 min-w-0">
            <select
              value={mic}
              onChange={e => onMicChange(e.target.value)}
              className="w-full bg-transparent text-xs text-white/40 outline-none cursor-pointer appearance-none pr-4 truncate [&>option]:bg-zinc-900 [&>option]:text-white"
              title="Microphone"
              data-testid={`select-mic-${label.toLowerCase()}`}
            >
              <option value="default">Default mic</option>
              {mics.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-white/15" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Speaker */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Volume2 className="w-3 h-3 text-white/40" />
          </div>
          <div className="relative flex-1 min-w-0">
            <select
              value={speaker}
              onChange={e => onSpeakerChange(e.target.value)}
              className="w-full bg-transparent text-xs text-white/40 outline-none cursor-pointer appearance-none pr-4 truncate [&>option]:bg-zinc-900 [&>option]:text-white"
              title="Speaker"
              data-testid={`select-speaker-${label.toLowerCase()}`}
            >
              <option value="default">Default speaker</option>
              {speakers.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-white/15" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ */
export default function Translation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { startStream } = useTranslationStream();
  const createTranslation = useCreateTranslation();
  const { mics, speakers, requestPermission } = useDevices();

  const [langA, setLangA] = useState("Japanese");
  const [langB, setLangB] = useState("English");
  const [micA, setMicA] = useState("default");
  const [speakerA, setSpeakerA] = useState("default");
  const [micB, setMicB] = useState("default");
  const [speakerB, setSpeakerB] = useState("default");

  const [messages, setMessages] = useState<Message[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [lastDetectedSide, setLastDetectedSide] = useState<"A" | "B" | null>(null);
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { startRecording, stopRecording } = useVoiceRecorder((data) => {
    setWaveformData(prev => [...prev.slice(-40), ...data]);
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeMic = lastDetectedSide === "A" ? micA : lastDetectedSide === "B" ? micB : "default";
  const activeSpeaker = lastDetectedSide === "A" ? speakerB : lastDetectedSide === "B" ? speakerA : "default";

  const handleStartRecord = async () => {
    if (status !== "idle") return;
    try {
      await requestPermission();
      setWaveformData([]);
      await startRecording(activeMic !== "default" ? activeMic : undefined);
      setStatus("recording");
    } catch {
      toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const handleStopRecord = async () => {
    if (status !== "recording") return;
    setStatus("processing");
    try {
      const blob = await stopRecording();
      if (!blob) { setStatus("idle"); return; }

      const id = crypto.randomUUID();
      setPendingMsgId(id);
      setMessages(prev => [...prev, {
        id, sourceLang: langA, sourceText: "…",
        targetLang: langB, translatedText: "", timestamp: new Date(),
      }]);

      let finalSource = "", finalTranslation = "";

      startStream(blob, langA, langB, activeSpeaker, {
        onUserTranscript: (text, srcLang) => {
          finalSource = text;
          setMessages(prev => prev.map(m => m.id === id ? { ...m, sourceText: text, sourceLang: srcLang } : m));
        },
        onDetectedLanguage: (lang, tgtLang) => {
          const side = lang.toLowerCase() === langA.toLowerCase() ? "A" : "B";
          setLastDetectedSide(side);
          setMessages(prev => prev.map(m => m.id === id ? { ...m, targetLang: tgtLang } : m));
        },
        onTranscript: (chunk) => {
          finalTranslation += chunk;
          setMessages(prev => prev.map(m => m.id === id ? { ...m, translatedText: finalTranslation } : m));
        },
        onDone: (srcLang, tgtLang) => {
          setPendingMsgId(null);
          setStatus("idle");
          setWaveformData([]);
          if (finalSource && finalTranslation) {
            createTranslation.mutate({ sourceLanguage: srcLang, targetLanguage: tgtLang, sourceText: finalSource, translatedText: finalTranslation });
          }
        },
        onError: (err) => {
          toast({ title: "Translation Failed", description: err.message, variant: "destructive" });
          setMessages(prev => prev.filter(m => m.id !== id));
          setPendingMsgId(null);
          setStatus("idle");
          setWaveformData([]);
        },
      });
    } catch (err) {
      console.error(err);
      setStatus("idle");
    }
  };

  const swapLanguages = () => {
    setSwapping(true);
    setTimeout(() => setSwapping(false), 400);
    setLangA(langB); setLangB(langA);
    setMicA(micB); setMicB(micA);
    setSpeakerA(speakerB); setSpeakerB(speakerA);
    setLastDetectedSide(s => s === "A" ? "B" : s === "B" ? "A" : null);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#0c0c0e] text-white overflow-hidden">

      {/* ─── Header ─── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">VoiceLink</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
          <span className="text-[10px] text-white/20 uppercase tracking-widest">Auto-detect</span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setLastDetectedSide(null); setStatus("idle"); setWaveformData([]); }}
            className="p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
            title="Clear conversation"
            data-testid="button-clear"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {messages.length === 0 && <div className="w-8" />}
      </header>



      {/* ─── Conversation Area ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0 border-t border-white/[0.05]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex items-center gap-3 text-3xl opacity-60">
              <span>{getLangFlag(langA)}</span>
              <ArrowLeftRight className="w-4 h-4 text-white/20" />
              <span>{getLangFlag(langB)}</span>
            </div>
            <div>
              <p className="text-white/25 font-medium text-sm mb-1">Ready to translate</p>
              <p className="text-white/12 text-xs max-w-[220px] leading-relaxed">
                Hold the button and speak in {langA} or {langB}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Record Footer ─── */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-6 pb-8 pt-4 flex flex-col items-center gap-3">

        {/* Waveform / status */}
        <div className="w-full max-w-xs h-10">
          {status === "recording" && <WaveformBars data={waveformData} />}
          {status === "processing" && (
            <div className="flex items-center justify-center gap-1.5 h-10 text-xs text-white/25">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
              <span className="ml-2 uppercase tracking-widest">Translating</span>
            </div>
          )}
          {status === "idle" && (
            <div className="flex items-center justify-center gap-[3px] h-10">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="w-[3px] h-1 rounded-full bg-white/[0.08]" />
              ))}
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-[10px] text-white/20 uppercase tracking-widest h-3">
          {status === "recording" ? "Release to translate" : status === "processing" ? "" : "Hold to speak"}
        </p>

        {/* Record button */}
        <button
          onPointerDown={handleStartRecord}
          onPointerUp={handleStopRecord}
          onPointerLeave={() => { if (status === "recording") handleStopRecord(); }}
          onContextMenu={e => e.preventDefault()}
          disabled={status === "processing"}
          data-testid="button-record"
          className={`
            relative flex items-center justify-center w-[72px] h-[72px] rounded-full
            select-none touch-none transition-all duration-200 ease-out
            ${status === "processing"
              ? "opacity-30 cursor-not-allowed scale-90 bg-white/10"
              : status === "recording"
                ? "scale-110 bg-rose-500 shadow-[0_0_0_10px_rgba(244,63,94,0.12),0_0_32px_rgba(244,63,94,0.25)]"
                : "bg-white hover:scale-[1.04] active:scale-95 shadow-[0_2px_32px_rgba(255,255,255,0.08)]"
            }
          `}
        >
          {status === "recording" && (
            <span className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-40" />
          )}
          <Mic className={`w-7 h-7 ${status === "recording" ? "text-white" : "text-zinc-950"}`} />
        </button>
      </div>
    </div>
  );
}
