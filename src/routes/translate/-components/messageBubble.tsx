import { getLangFlag } from "../-actions";

interface Message {
  id: string;
  sourceLang: string;
  sourceText: string;
  targetLang: string;
  translatedText: string;
  timestamp: Date;
}

export function MessageBubble({ msg }: { msg: Message }) {
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
