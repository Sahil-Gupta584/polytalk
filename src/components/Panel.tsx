import { Mic, Volume2, Globe2 } from "lucide-react";
import { useDevices } from "@/hooks/use-devices";
import { Waveform } from "@/components/Waveform";

interface PanelProps {
  side: 'top' | 'bottom';
  theme: 'dark' | 'light';
  language: string;
  onLanguageChange: (val: string) => void;
  mic: string;
  onMicChange: (val: string) => void;
  speaker: string;
  onSpeakerChange: (val: string) => void;
  userText: string;
  translatedText: string;
  isRecording: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
  disabled: boolean;
  waveformData?: number[];
}

const LANGUAGES = [
  "English", "Japanese", "Spanish", "French", 
  "German", "Chinese", "Korean", "Italian"
];

export function Panel({
  side, theme, language, onLanguageChange, mic, onMicChange, speaker, onSpeakerChange,
  userText, translatedText, isRecording, onStartRecord, onStopRecord, disabled, waveformData = []
}: PanelProps) {
  const { mics, speakers, hasPermission, requestPermission } = useDevices();
  const isDark = theme === 'dark';

  const handlePointerDown = () => {
    if (disabled) return;
    if (!hasPermission) requestPermission();
    onStartRecord();
  };

  const handlePointerUp = () => {
    if (disabled) return;
    onStopRecord();
  };

  const handlePointerLeave = () => {
    if (isRecording) onStopRecord();
  };

  return (
    <div className={`
      flex-1 relative w-full flex flex-col p-6 transition-colors duration-700 overflow-hidden
      ${isDark ? 'bg-zinc-950 text-white' : 'bg-[#FAFAFA] text-zinc-900'}
      ${side === 'top' ? 'rotate-180' : ''}
    `}>
      {/* Background ambient gradients */}
      <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden mix-blend-screen dark:mix-blend-lighten">
        <div className={`absolute -top-20 -left-20 w-96 h-96 rounded-full blur-[100px] animate-blob ${isDark ? 'bg-indigo-600/40' : 'bg-orange-300/40'}`}></div>
        <div className={`absolute bottom-20 -right-20 w-96 h-96 rounded-full blur-[100px] animate-blob animation-delay-2000 ${isDark ? 'bg-rose-600/30' : 'bg-blue-300/30'}`}></div>
      </div>

      {/* Top Bar - Settings */}
      <div className="flex justify-between items-center z-10 relative">
        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-black/5 dark:border-white/10">
           <Globe2 className="w-4 h-4 opacity-70" />
           <select
             value={language}
             onChange={e => onLanguageChange(e.target.value)}
             className={`bg-transparent text-sm md:text-base font-bold outline-none focus:ring-0 cursor-pointer appearance-none pr-2
               ${isDark ? '[&>option]:bg-zinc-900' : '[&>option]:bg-white'}
             `}
           >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
           </select>
        </div>

        <div className="flex items-center gap-2">
           {/* Mic Select */}
           <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-black/5 dark:border-white/10 hover:bg-black/10 transition-colors">
             <Mic className="w-3.5 h-3.5 opacity-70" />
             <select 
               value={mic} 
               onChange={e => onMicChange(e.target.value)} 
               className={`bg-transparent text-xs w-16 md:w-24 truncate outline-none cursor-pointer appearance-none
                 ${isDark ? '[&>option]:bg-zinc-900' : '[&>option]:bg-white'}
               `}
             >
               <option value="default">Def. Mic</option>
               {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || 'Mic'}</option>)}
             </select>
           </div>
           {/* Speaker Select */}
           <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-black/5 dark:border-white/10 hover:bg-black/10 transition-colors">
             <Volume2 className="w-3.5 h-3.5 opacity-70" />
             <select 
               value={speaker} 
               onChange={e => onSpeakerChange(e.target.value)} 
               className={`bg-transparent text-xs w-16 md:w-24 truncate outline-none cursor-pointer appearance-none
                 ${isDark ? '[&>option]:bg-zinc-900' : '[&>option]:bg-white'}
               `}
             >
               <option value="default">Def. Speaker</option>
               {speakers.map(s => <option key={s.deviceId} value={s.deviceId}>{s.label || 'Speaker'}</option>)}
             </select>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center text-center max-w-4xl mx-auto w-full px-4 gap-6 z-10 relative">
        
        {/* Waveform Visualization */}
        {isRecording && waveformData.length > 0 && (
          <div className="w-full">
            <Waveform data={waveformData} isDark={isDark} />
          </div>
        )}
        
        {/* The large translated text addressed to this person */}
        {translatedText && (
          <div className="text-4xl md:text-5xl lg:text-7xl font-display font-bold leading-tight tracking-tight text-shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            {translatedText}
          </div>
        )}

        {/* The small user transcript showing what this person said */}
        {userText && (
          <div className={`text-lg md:text-2xl font-medium opacity-60 animate-in fade-in duration-300 ${translatedText ? 'mt-4 md:mt-8' : ''}`}>
            "{userText}"
          </div>
        )}

        {!translatedText && !userText && (
          <div className="flex flex-col items-center gap-4 opacity-30 mt-10">
            <Mic className="w-8 h-8" />
            <div className="text-xl md:text-2xl font-display font-medium">
              Hold to speak {language}
            </div>
          </div>
        )}
      </div>

      {/* Record Button Footer */}
      <div className="flex justify-center pb-8 pt-4 z-20 relative">
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={e => e.preventDefault()}
          disabled={disabled}
          className={`
            relative group flex items-center justify-center
            w-24 h-24 md:w-32 md:h-32 rounded-full
            shadow-2xl transition-all duration-300 ease-out
            ${disabled ? 'opacity-20 cursor-not-allowed scale-90' : 'hover:scale-105 active:scale-95 cursor-pointer'}
            ${isRecording 
                ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.6)]' 
                : (isDark ? 'bg-white text-zinc-950 hover:bg-zinc-100' : 'bg-zinc-900 text-white hover:bg-zinc-800')}
          `}
        >
          {/* Active recording rings */}
          {isRecording && (
            <>
              <span className="absolute inset-0 rounded-full border-4 border-rose-500 animate-ping opacity-60 duration-1000"></span>
              <span className="absolute -inset-6 rounded-full border-2 border-rose-500/40 animate-ping animation-delay-500 duration-1000"></span>
            </>
          )}
          <Mic className={`w-10 h-10 md:w-12 md:h-12 ${isRecording ? 'text-white' : ''} transition-colors duration-300`} />
        </button>
      </div>
    </div>
  );
}
