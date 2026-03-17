export const Route = createFileRoute("/")({ component: Landing });

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	ChevronRight,
	Globe2,
	Headphones,
	Mic,
	SmartphoneNfc,
	Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { getLangFlagUrl } from "./translate/-actions";

/* ─────────────────────────────────────────────────── */
/*  Static page data                                   */
/* ─────────────────────────────────────────────────── */

const STEPS = [
	{
		icon: Globe2,
		step: "01",
		title: "Each person picks their language",
		desc: "Configure Language A and Language B. PolyTalk auto-detects which one you're speaking.",
	},
	{
		icon: Mic,
		step: "02",
		title: "Hold & speak naturally",
		desc: "Press and hold the mic button. Speak in your language at your normal pace.",
	},
	{
		icon: Volume2,
		step: "03",
		title: "Translation plays out loud",
		desc: "Release. The AI translates and speaks the result in the other person's language instantly.",
	},
];

const PROBLEMS = [
	{ emoji: "🇯🇵", scene: "Asking for directions in Tokyo" },
	{ emoji: "🇪🇸", scene: "Ordering food in Barcelona" },
	{ emoji: "🇸🇦", scene: "Negotiating at a market in Dubai" },
	{ emoji: "🇫🇷", scene: "Chatting with locals in Paris" },
];

const DEMO_CONVERSATIONS = [
	{
		fromFlag: "🇯🇵",
		fromLang: "Japanese",
		fromCountryCode: "JP",
		toFlag: "🇬🇧",
		toLang: "English",
		toCountryCode: "GB",
		sourceText: "すみません、近くに駅はありますか？",
		translatedText: "Excuse me, is there a train station nearby?",
	},
	{
		fromFlag: "🇬🇧",
		fromLang: "English",
		fromCountryCode: "GB",
		toFlag: "🇯🇵",
		toLang: "Japanese",
		toCountryCode: "JP",
		sourceText: "Yes, it's two blocks straight ahead.",
		translatedText: "はい、真っ直ぐ2ブロック先にあります。",
	},
	{
		fromFlag: "🇪🇸",
		fromLang: "Spanish",
		fromCountryCode: "ES",
		toFlag: "🇬🇧",
		toLang: "English",
		toCountryCode: "GB",
		sourceText: "¿Cuánto cuesta este plato?",
		translatedText: "How much does this dish cost?",
	},
	{
		fromFlag: "🇬🇧",
		fromLang: "English",
		fromCountryCode: "GB",
		toFlag: "🇸🇦",
		toLang: "Arabic",
		toCountryCode: "SA",
		sourceText: "Two coffees please, no sugar.",
		translatedText: "قهوتين من فضلك، بدون سكر.",
	},
];

/* ─────────────────────────────────────────────────── */
/*  Demo App Preview                                   */
/* ─────────────────────────────────────────────────── */
type DemoPhase = "idle" | "recording" | "processing" | "result";

function WaveformDemo({ active }: { active: boolean }) {
	const heights = [
		0.3, 0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.85, 0.55, 0.7, 0.4, 0.9, 0.6,
	];
	return (
		<div className="flex items-center justify-center gap-[3px] h-7">
			{heights.map((h, i) => (
				<div
					key={i}
					className={`rounded-full transition-all duration-150 ${active ? "wave-bar" : ""}`}
					style={{
						width: 2.5,
						height: active ? `${Math.max(3, h * 28)}px` : 3,
						background: active
							? `rgba(255,255,255,${0.35 + h * 0.55})`
							: "rgba(255,255,255,0.12)",
						animationDelay: active ? `${i * 0.08}s` : undefined,
						animationDuration: active ? `${0.9 + (i % 3) * 0.22}s` : undefined,
					}}
				/>
			))}
		</div>
	);
}

function Typewriter({ text, active }: { text: string; active: boolean }) {
	const [displayed, setDisplayed] = useState("");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!active) {
			setDisplayed("");
			return;
		}
		let i = 0;
		const tick = () => {
			i++;
			setDisplayed(text.slice(0, i));
			if (i < text.length) timerRef.current = setTimeout(tick, 38);
		};
		timerRef.current = setTimeout(tick, 100);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [active, text]);

	return (
		<span>
			{displayed}
			{active && displayed.length < text.length && (
				<span className="inline-block w-0.5 h-3.5 bg-white/60 ml-0.5 animate-pulse align-middle" />
			)}
		</span>
	);
}

function AppPreviewDemo() {
	const [convIdx, setConvIdx] = useState(0);
	const [phase, setPhase] = useState<DemoPhase>("idle");
	const conv = DEMO_CONVERSATIONS[convIdx];

	useEffect(() => {
		const TIMELINE: [DemoPhase, number][] = [
			["idle", 1800],
			["recording", 2400],
			["processing", 800],
			["result", 3200],
		];

		let step = 0;
		let timer: ReturnType<typeof setTimeout>;

		const advance = () => {
			const [nextPhase, delay] = TIMELINE[step % TIMELINE.length];
			setPhase(nextPhase);
			step++;
			if (step % TIMELINE.length === 0) {
				// next conversation after full cycle
				setConvIdx((i) => (i + 1) % DEMO_CONVERSATIONS.length);
			}
			timer = setTimeout(advance, delay);
		};

		timer = setTimeout(advance, 1800);
		return () => clearTimeout(timer);
	}, []);

	const isRecording = phase === "recording";
	const isProcessing = phase === "processing";
	const isResult = phase === "result";

	return (
		<div className="relative flex items-center justify-center select-none">
			{/* Ambient glow behind the card */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="w-64 h-64 rounded-full bg-indigo-600/10 blur-[60px]" />
			</div>

			{/* Phone frame */}
			<div
				className="relative z-10 w-[280px] rounded-[2rem] border border-white/[0.1] bg-[#111113] shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden"
				style={{ transform: "perspective(900px) rotateX(2deg) rotateY(-6deg)" }}
			>
				{/* Status bar */}
				<div className="flex items-center justify-between px-5 pt-4 pb-1">
					<span className="text-[10px] text-white/25 font-medium">9:41</span>
					<div className="flex items-center gap-1.5">
						<span className="w-1 h-1 rounded-full bg-emerald-400/70 animate-pulse" />
						<span className="text-[10px] text-white/20 uppercase tracking-widest">
							Auto-detect
						</span>
					</div>
				</div>

				{/* Language Cards */}
				<div className="flex items-stretch gap-2 px-3 pb-2 pt-1">
					{/* Card A */}
					<div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5">
						<div className="text-[9px] text-white/20 uppercase tracking-widest mb-1.5">
							Person A
						</div>
						<div className="flex items-center gap-1.5 mb-2">
							<img
								src={getLangFlagUrl(conv.fromCountryCode.toLocaleUpperCase(),true)}
								alt=""
								className="h-6 w-6 rounded-full object-cover"
							/>
							<span className="text-xs font-semibold text-white/80 truncate">
								{conv.fromLang}
							</span>
						</div>
						<div className="h-px bg-white/[0.06] mb-2" />
						<div className="flex items-center gap-1 text-[9px] text-white/25">
							<Mic className="w-2.5 h-2.5" /> Default mic
						</div>
						<div className="flex items-center gap-1 text-[9px] text-white/25 mt-1">
							<Volume2 className="w-2.5 h-2.5" /> Default speaker
						</div>
					</div>

					{/* Swap pill */}
					<div className="flex flex-col items-center justify-center">
						<div className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center">
							<ArrowLeftRight className="w-3 h-3 text-white/20" />
						</div>
					</div>

					{/* Card B */}
					<div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5">
						<div className="text-[9px] text-white/20 uppercase tracking-widest mb-1.5">
							Person B
						</div>
						<div className="flex items-center gap-1.5 mb-2">
							<img
								src={getLangFlagUrl(conv.toCountryCode.toLocaleUpperCase(),true)}
								alt=""
								className="h-6 w-6 rounded-full object-cover"
							/>
							<span className="text-lg text-sm leading-none">{conv.toLang}</span>
						</div>
						<div className="h-px bg-white/[0.06] mb-2" />
						<div className="flex items-center gap-1 text-[9px] text-white/25">
							<Mic className="w-2.5 h-2.5" /> Default mic
						</div>
						<div className="flex items-center gap-1 text-[9px] text-white/25 mt-1">
							<Volume2 className="w-2.5 h-2.5" /> Default speaker
						</div>
					</div>
				</div>

				{/* Divider */}
				<div className="h-px bg-white/[0.05] mx-3" />

				{/* Conversation area — fixed height */}
				<div className="h-[110px] px-3 py-2 flex flex-col justify-end overflow-hidden">
					{/* Empty idle hint */}
					{phase === "idle" && (
						<div className="flex flex-col items-center justify-center h-full gap-2">
							<div className="flex items-center gap-2 text-xl opacity-50">
								<span>{conv.fromFlag}</span>
								<ArrowLeftRight className="w-3 h-3 text-white/20" />
								<span>{conv.toFlag}</span>
							</div>
							<p className="text-[9px] text-white/15 text-center">
								Hold to speak in {conv.fromLang} or {conv.toLang}
							</p>
						</div>
					)}

					{/* Recording — show typewriter source text */}
					{isRecording && (
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center gap-1.5">
								<span className="text-sm">{conv.fromFlag}</span>
								<span className="text-[9px] text-white/30 uppercase tracking-widest">
									{conv.fromLang}
								</span>
							</div>
							<p className="text-[11px] text-white/50 leading-relaxed pl-5">
								<Typewriter text={conv.sourceText} active={true} />
							</p>
						</div>
					)}

					{/* Processing dots */}
					{isProcessing && (
						<div className="flex items-center justify-center gap-1.5 h-full">
							{[0, 150, 300].map((d) => (
								<span
									key={d}
									className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce"
									style={{ animationDelay: `${d}ms` }}
								/>
							))}
						</div>
					)}

					{/* Result card */}
					{isResult && (
						<div className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
							<div className="flex items-center gap-1">
								<span className="text-sm">{conv.fromFlag}</span>
								<span className="text-[9px] text-white/30 uppercase tracking-widest">
									{conv.fromLang}
								</span>
							</div>
							<p className="text-[10px] text-white/40 leading-snug pl-5">
								{conv.sourceText}
							</p>
							<div className="flex items-start gap-1 mt-1">
								<span className="text-sm">{conv.toFlag}</span>
								<p className="text-[11px] text-white font-medium leading-snug">
									{conv.translatedText}
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Divider */}
				<div className="h-px bg-white/[0.05] mx-3" />

				{/* Footer — waveform + record button */}
				<div className="flex flex-col items-center gap-2 py-4">
					<WaveformDemo active={isRecording} />

					<p className="text-[9px] text-white/15 uppercase tracking-widest">
						{isRecording
							? "Release to translate"
							: isProcessing
								? "Translating..."
								: "Hold to speak"}
					</p>

					{/* Record button */}
					<div
						className={`
              relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300
              ${
								isProcessing
									? "bg-white/10 opacity-40"
									: isRecording
										? "bg-rose-500 shadow-[0_0_0_8px_rgba(244,63,94,0.12),0_0_20px_rgba(244,63,94,0.3)] scale-110"
										: "bg-white shadow-[0_2px_16px_rgba(255,255,255,0.1)]"
							}
            `}
					>
						{isRecording && (
							<span className="absolute inset-0 rounded-full border border-rose-400 animate-ping opacity-40" />
						)}
						<Mic
							className={`w-5 h-5 ${isRecording ? "text-white" : "text-zinc-900"}`}
						/>
					</div>
				</div>
			</div>

			{/* Floating label underneath */}
			<div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[10px] text-white/15 whitespace-nowrap">
				<span className="w-1 h-1 rounded-full bg-emerald-400/50 animate-pulse" />
				Live demo — auto-plays
			</div>
		</div>
	);
}

/* ─────────────────────────────────────────────────── */
/*  Page                                               */
/* ─────────────────────────────────────────────────── */
export default function Landing() {
	const [, setLocation] = useLocation();

	return (
		<div className="w-full min-h-[100dvh] bg-matte-dark text-white relative overflow-y-auto overflow-x-hidden grain">
			{/* Ambient glow */}
			<div className="pointer-events-none fixed inset-0 z-0">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[180px] bg-indigo-900/15" />
			</div>

			{/* ─── Topbar ─── */}
			<header className="relative z-20 flex items-center justify-between px-6 md:px-14 py-6 border-b border-white/[0.05]">
				<div className="flex items-center gap-2.5">
					<div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center">
						<Mic className="w-3.5 h-3.5 text-white/70" />
					</div>
					<span className="text-white/60 text-sm font-semibold tracking-wide">
						PolyTalk
					</span>
				</div>
				<Link to="/translate">
					<button
						className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.07] border border-white/10 text-white/60 text-xs font-medium hover:bg-white/10 hover:text-white/80 transition-all duration-200"
						data-testid="button-start-translation-nav"
					>
						Open App <ChevronRight className="w-3 h-3 opacity-50" />
					</button>
				</Link>
			</header>

			{/* ─── HERO — two column ─── */}
			<section className="relative z-10 px-6 md:px-14 pt-16 pb-28 max-w-6xl mx-auto">
				<div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
					{/* Left — copy */}
					<div className="flex-1 flex flex-col items-start text-left max-w-xl">
						<div className="mb-7 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-white/40 text-xs font-medium tracking-widest uppercase">
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
							Real-time · 100+ languages · No account needed
						</div>

						<h1 className="font-display text-[clamp(2.4rem,6vw,5rem)] font-bold leading-[1.04] tracking-tight text-white mb-6">
							The language barrier
							<br />
							<span className="text-white/25">ends here.</span>
						</h1>

						<p className="text-white/40 text-base md:text-lg leading-relaxed mb-10 max-w-md">
							PolyTalk lets two people speak face-to-face in completely
							different languages — and actually understand each other — in real
							time.
						</p>
						<Link to="/translate">
							<button
								data-testid="button-start-translation"
								className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-white text-zinc-950 font-semibold text-[15px] tracking-tight hover:bg-white/90 transition-all duration-200 active:scale-95"
							>
								<Mic className="w-4 h-4" />
								Start Translating — Free
								<ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-0.5 transition-transform duration-200" />
							</button>
						</Link>
						<p className="mt-3 text-white/15 text-xs">
							Works instantly in your browser. No install.
						</p>
					</div>

					{/* Right — interactive demo */}
					<div className="flex-shrink-0 w-full md:w-auto flex justify-center pb-10">
						<AppPreviewDemo />
					</div>
				</div>
			</section>

			{/* ─── THE PROBLEM ─── */}
			<section className="relative z-10 px-6 py-20 border-t border-white/[0.05]">
				<div className="max-w-4xl mx-auto">
					<p className="text-white/25 text-xs uppercase tracking-widest mb-4 text-center">
						The problem we solve
					</p>
					<h2 className="font-display text-3xl md:text-5xl font-bold text-center mb-5 leading-tight">
						You're standing in front of someone.
						<br />
						<span className="text-white/30">
							Neither of you can say a word.
						</span>
					</h2>
					<p className="text-center text-white/35 text-base md:text-lg max-w-2xl mx-auto mb-14 leading-relaxed">
						You're a traveller. You meet locals, shopkeepers, hotel staff,
						strangers who want to help — but the conversation stops before it
						starts. Translation apps require you to type, wait, and show a
						screen. That's not a conversation.
					</p>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						{PROBLEMS.map(({ emoji, scene }) => (
							<div
								key={scene}
								className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] text-center hover:bg-white/[0.05] transition-colors"
							>
								<span className="text-3xl">{emoji}</span>
								<p className="text-white/40 text-xs leading-snug">{scene}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ─── HOW IT WORKS ─── */}
			<section className="relative z-10 px-6 py-20 border-t border-white/[0.05]">
				<div className="max-w-4xl mx-auto">
					<p className="text-white/25 text-xs uppercase tracking-widest mb-4 text-center">
						How it works
					</p>
					<h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-14">
						Three steps to a full conversation.
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{STEPS.map(({ icon: Icon, step, title, desc }) => (
							<div
								key={step}
								className="flex flex-col gap-4 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] transition-colors"
							>
								<div className="flex items-center justify-between">
									<div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
										<Icon className="w-4 h-4 text-white/60" />
									</div>
									<span className="font-display text-4xl font-bold text-white/[0.06]">
										{step}
									</span>
								</div>
								<h3 className="font-semibold text-white/80 text-base leading-snug">
									{title}
								</h3>
								<p className="text-white/35 text-sm leading-relaxed">{desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ─── FINAL CTA ─── */}
			<section className="relative z-10 px-6 py-24 border-t border-white/[0.05]">
				<div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
					<h2 className="font-display text-3xl md:text-5xl font-bold leading-tight">
						Your next trip, without
						<br />
						<span className="text-white/30">language anxiety.</span>
					</h2>
					<p className="text-white/35 text-base max-w-md leading-relaxed">
						Open PolyTalk, pick your languages, and have a real conversation —
						wherever you are in the world.
					</p>
					<Link to="/translate">
						<button className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-zinc-950 font-semibold text-[15px] hover:bg-white/90 transition-all duration-200 active:scale-95">
							<Mic className="w-4 h-4" />
							Start Translating — Free
							<ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-0.5 transition-transform" />
						</button>
					</Link>
				</div>
			</section>

			{/* ─── Footer ─── */}
			<footer className="relative z-10 px-6 md:px-14 py-6 border-t border-white/[0.05] flex items-center justify-between">
				<span className="text-white/15 text-xs">
					Powered by OpenAI · Lingo.dev
				</span>
				<span className="text-white/15 text-xs">PolyTalk © 2026</span>
			</footer>
		</div>
	);
}
