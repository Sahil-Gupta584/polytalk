import { Mic, Volume2 } from "lucide-react";
import { getLangFlag, LANGUAGES } from "../-actions";

export function LangCard({
	label,
	lang,
	onLangChange,
	mic,
	onMicChange,
	speaker,
	onSpeakerChange,
	mics,
	speakers,
	highlight,
}: {
	label: "A" | "B";
	lang: string;
	onLangChange: (v: string) => void;
	mic: string;
	onMicChange: (v: string) => void;
	speaker: string;
	onSpeakerChange: (v: string) => void;
	mics: MediaDeviceInfo[];
	speakers: MediaDeviceInfo[];
	highlight?: boolean;
}) {
	const flag = getLangFlag(lang);
	return (
		<div
			className={`
      flex-1 flex flex-col gap-3 rounded-2xl p-4 border transition-all duration-300
      ${
				highlight
					? "bg-white/[0.07] border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
					: "bg-white/[0.03] border-white/[0.07]"
			}
    `}
		>
			{/* Label badge */}
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.15em]">
					Person {label}
				</span>
				{highlight && (
					<span className="text-[10px] text-emerald-400/70 uppercase tracking-widest">
						Speaking
					</span>
				)}
			</div>

			{/* Flag + Language selector */}
			<div className="flex items-center gap-2">
				<span className="text-2xl leading-none">{flag}</span>
				<div className="relative flex-1">
					<select
						value={lang}
						onChange={(e) => onLangChange(e.target.value)}
						className="w-full bg-transparent text-white font-semibold text-base outline-none cursor-pointer appearance-none pr-5 [&>option]:bg-zinc-900 [&>option]:text-white"
						data-testid={`select-lang-${label.toLowerCase()}`}
					>
						{LANGUAGES.map((l) => (
							<option key={l.name} value={l.name}>
								{l.name}
							</option>
						))}
					</select>
					{/** biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
					<svg
						className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25"
						viewBox="0 0 12 12"
						fill="none"
					>
						<path
							d="M3 4.5l3 3 3-3"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
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
							onChange={(e) => onMicChange(e.target.value)}
							className="w-full bg-transparent text-xs text-white/40 outline-none cursor-pointer appearance-none pr-4 truncate [&>option]:bg-zinc-900 [&>option]:text-white"
							title="Microphone"
							data-testid={`select-mic-${label.toLowerCase()}`}
						>
							<option value="default">Default mic</option>
							{mics.map((d) => (
								<option key={d.deviceId} value={d.deviceId}>
									{d.label || `Mic ${d.deviceId.slice(0, 6)}`}
								</option>
							))}
						</select>
						<svg
							className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-white/15"
							viewBox="0 0 12 12"
							fill="none"
						>
							<title>Dropdown arrow</title>
							<path
								d="M3 4.5l3 3 3-3"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
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
							onChange={(e) => onSpeakerChange(e.target.value)}
							className="w-full bg-transparent text-xs text-white/40 outline-none cursor-pointer appearance-none pr-4 truncate [&>option]:bg-zinc-900 [&>option]:text-white"
							title="Speaker"
							data-testid={`select-speaker-${label.toLowerCase()}`}
						>
							<option value="default">Default speaker</option>
							{speakers.map((d) => (
								<option key={d.deviceId} value={d.deviceId}>
									{d.label || `Speaker ${d.deviceId.slice(0, 6)}`}
								</option>
							))}
						</select>
						<svg
							className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-white/15"
							viewBox="0 0 12 12"
							fill="none"
						>
							<title>arrow</title>
							<path
								d="M3 4.5l3 3 3-3"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
				</div>
			</div>
		</div>
	);
}
