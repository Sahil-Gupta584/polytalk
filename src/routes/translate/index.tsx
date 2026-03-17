import { createFileRoute, Link } from "@tanstack/react-router";
import langs from "langs";
import { ArrowLeft, ArrowLeftRight, Mic, MicVocal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDevices } from "@/hooks/use-devices";
import { useToast } from "@/hooks/use-toast";
import { useTranslationStream } from "@/hooks/use-translation-stream";
import { useVoiceDetection } from "@/hooks/use-voice-detection";
import { getLangFlag } from "./-actions";
import { LangCard } from "./-components/langCard";
import { type Message, MessageBubble } from "./-components/messageBubble";
import { WaveformBars } from "./-components/waveformbars";

const IDLE_BAR_KEYS = Array.from(
	{ length: 24 },
	(_, index) => `idle-bar-${index}`,
);

function getLanguageCode(name: string) {
	return langs.where("name", name)?.["1"] || "en";
}

function langToLocale(lang: string) {
	const maximized = new Intl.Locale(lang).maximize();
	return maximized.region
		? `${maximized.language}-${maximized.region}`
		: maximized.language;
}

function voiceMatchesLanguage(
	voice: SpeechSynthesisVoice | null | undefined,
	languageCode: string,
): boolean {
	if (!voice) {
		return false;
	}

	const normalizedTarget = languageCode.toLowerCase();
	const normalizedVoiceLang = voice.lang.toLowerCase();

	return (
		normalizedVoiceLang === normalizedTarget ||
		normalizedVoiceLang.startsWith(`${normalizedTarget}-`)
	);
}

export const Route = createFileRoute("/translate/")({
	component: Translation,
});

export default function Translation() {
	const { toast } = useToast();
	const { mics, speakers, hasPermission, requestPermission } = useDevices();
	const [messages, setMessages] = useState<Message[]>([]);
	const [waveformData, setWaveformData] = useState<number[]>([]);

	const [langA, setLangA] = useState("Japanese");
	const [langB, setLangB] = useState("English");
	const [micA, setMicA] = useState("default");
	const [speakerA, setSpeakerA] = useState("default");
	const [micB, setMicB] = useState("default");
	const [speakerB, setSpeakerB] = useState("default");
	const [activeSide, setActiveSide] = useState<"A" | "B">("A");
	const [liveTranscript, setLiveTranscript] = useState("");
	const [liveTranslation, setLiveTranslation] = useState("");
	const [swapping, setSwapping] = useState(false);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const micLevelRef = useRef(0);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const savedLangA = window.localStorage.getItem("parley:langA");
		const savedLangB = window.localStorage.getItem("parley:langB");
		const savedMicA = window.localStorage.getItem("parley:micA");
		const savedMicB = window.localStorage.getItem("parley:micB");
		const savedSpeakerA = window.localStorage.getItem("parley:speakerA");
		const savedSpeakerB = window.localStorage.getItem("parley:speakerB");

		if (savedLangA) setLangA(savedLangA);
		if (savedLangB) setLangB(savedLangB);
		if (savedMicA) setMicA(savedMicA);
		if (savedMicB) setMicB(savedMicB);
		if (savedSpeakerA) setSpeakerA(savedSpeakerA);
		if (savedSpeakerB) setSpeakerB(savedSpeakerB);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem("parley:langA", langA);
		window.localStorage.setItem("parley:langB", langB);
	}, [langA, langB]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem("parley:micA", micA);
		window.localStorage.setItem("parley:micB", micB);
		window.localStorage.setItem("parley:speakerA", speakerA);
		window.localStorage.setItem("parley:speakerB", speakerB);
	}, [micA, micB, speakerA, speakerB]);
	const [status, setStatus] = useState<"idle" | "recording" | "processing">(
		"idle",
	);

	const isProcessingRef = useRef(false);
	const ttsRequestIdRef = useRef(0);
	const { startStream, stopStream: stopTranslationStream } =
		useTranslationStream();
	const {
		isListening,
		isRecording,
		setIsProcessing: setIsVoiceProcessing,
		startListening,
		stopListening,
		startManualRecording,
		stopManualRecording,
	} = useVoiceDetection({
		mode: "manual",
		paddingDuration: 2000, // 2 seconds of audio padding
		onVoiceStart: () => {
			setLiveTranscript("");
			setLiveTranslation("");
			setStatus("recording");
		},
		onVoiceEnd: (audioBlob) => {
			setStatus("processing");
			void processAudio(audioBlob);
		},
		onLevelChange: (level) => {
			micLevelRef.current = level;
		},
	});

	useEffect(() => {
		if (status !== "recording") {
			setWaveformData([]);
			return;
		}

		const intervalId = window.setInterval(() => {
			const normalized = Math.min(1, Math.max(0, micLevelRef.current));
			setWaveformData(
				Array.from({ length: 24 }, (_, index) => {
					const oscillation = Math.sin((index / 24) * Math.PI * 2) * 0.04;
					const jitter = Math.random() * 0.25;
					const value = normalized * 0.85 + jitter + oscillation;
					return Math.min(1, Math.max(0, value));
				}),
			);
		}, 120);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [status]);

	const swapLanguages = () => {
		setSwapping(true);
		setTimeout(() => setSwapping(false), 400);
		setLangA(langB);
		setLangB(langA);
		setMicA(micB);
		setMicB(micA);
		setSpeakerA(speakerB);
		setSpeakerB(speakerA);
	};

	const processAudio = async (audioFile: File | Blob) => {
		if (isProcessingRef.current) return;

		const primaryLanguageCode = getLanguageCode(langA);
		const secondaryLanguage = getLanguageCode(langB);
		const targetSpeaker = activeSide === "A" ? speakerB : speakerA;

		if (
			!primaryLanguageCode ||
			!secondaryLanguage ||
			primaryLanguageCode === secondaryLanguage
		) {
			toast({
				title: "Language Setup Required",
				description: "Select two different languages before recording.",
				variant: "destructive",
			});
			setStatus("idle");
			return;
		}

		isProcessingRef.current = true;
		setIsVoiceProcessing(true);

		try {
			setLiveTranscript("");
			setLiveTranslation("");

			await startStream(
				audioFile,
				primaryLanguageCode,
				secondaryLanguage,
				(text) => {
					setLiveTranscript(text || "");
				},
				() => {},
				(text) => {
					setLiveTranslation(text);
				},
				(result) => {
					if (!result.userTranscript.trim()) {
						setLiveTranscript("");
						setLiveTranslation("");
						return;
					}

					setMessages((current) => [
						...current,
						{
							id: crypto.randomUUID(),
							translatedText: result.translatedText,
							timestamp: new Date(),
							lang: result.sourceLang,
						},
					]);
					window.setTimeout(() => {
						messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
					}, 0);

					if (result.translatedText.trim()) {
						void playTranslatedAudio(
							result.translatedText,
							result.targetLang,
							targetSpeaker,
						);
					}

					setLiveTranscript("");
					setLiveTranslation("");
					setActiveSide((current) => (current === "A" ? "B" : "A"));
				},
				(err) => {
					console.error("Error processing audio:", err);
					toast({
						title: "Translation Failed",
						description: err.message,
						variant: "destructive",
					});
					setLiveTranscript("");
					setLiveTranslation("");
				},
			);
		} catch (err) {
			console.error("Error processing audio:", err);
			toast({
				title: "Translation Failed",
				description:
					err instanceof Error ? err.message : "Failed to process audio",
				variant: "destructive",
			});
			setLiveTranscript("");
			setLiveTranslation("");
		} finally {
			isProcessingRef.current = false;
			setIsVoiceProcessing(false);
		}
	};

	const playTranslatedAudio = async (
		text: string,
		secondaryLanguage: string,
		targetSpeaker: string,
	) => {
		if (!text.trim()) {
			console.debug("[TTS] skipped empty text");
			return;
		}

		const requestId = ++ttsRequestIdRef.current;

		if (typeof window === "undefined") {
			console.debug("[TTS] window not available");
			return;
		}

		window.speechSynthesis.cancel();

		if (requestId !== ttsRequestIdRef.current) {
			console.debug("[TTS] request superseded", requestId);
			return;
		}

		try {
			const targetLocale = langToLocale(secondaryLanguage);
			const shouldUseBrowserVoice = false

			if (!shouldUseBrowserVoice || targetSpeaker !== "default") {
				console.debug("[TTS] falling back to Google", {
					text,
					targetLocale,
					targetSpeaker,
				});
				const res = await fetch("/api/translate/audio/tts", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						text,
						languageCode: targetLocale,
					}),
				});

				if (!res.ok) {
					throw new Error(`Google TTS failed with status ${res.status}`);
				}

				const data = (await res.json()) as { audio?: string };
				if (!data.audio) {
					throw new Error("Google TTS returned no audio");
				}

				const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
				if (targetSpeaker !== "default" && "setSinkId" in audio) {
					try {
						await (
							audio as HTMLAudioElement & {
								setSinkId: (id: string) => Promise<void>;
							}
						).setSinkId(targetSpeaker);
					} catch (sinkError) {
						console.warn("[TTS] speaker sink change failed", sinkError);
					}
				}
				await audio.play();
				return;
			}

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.rate = 0.95;
			utterance.volume = 1;
			utterance.pitch = 1;
			utterance.lang = targetLocale;

			utterance.onstart = () => {
				console.debug("[TTS] browser voice started", {
					text,
					lang: utterance.lang,
				});
			};

			utterance.onend = () => {
				if (ttsRequestIdRef.current === requestId) {
					ttsRequestIdRef.current = 0;
				}
			};

			utterance.onerror = (event) => {
				console.error("[TTS] speech synthesis failed:", event);
			};

			window.speechSynthesis.resume();
			console.log("speaking through SpeechSynthesisUtterance", {
				targetLocale,
			});

			window.speechSynthesis.speak(utterance);
		} catch (error) {
			console.error("Error playing translated audio:", error);
		}finally{
			setStatus('idle')
		}
	};

	const handleRecordButtonDown = async () => {
		if (!isListening) {
			// Initialize listening first
			if (
				!langA ||
				!langB ||
				getLanguageCode(langA) === getLanguageCode(langB)
			) {
				toast({
					title: "Language Setup Required",
					description: "Choose two different languages before recording.",
					variant: "destructive",
				});
				return;
			}

			try {
				if (!hasPermission) {
					await requestPermission();
				}

				const activeMic = activeSide === "A" ? micA : micB;
				await startListening(activeMic);
			} catch {
				toast({
					title: "Microphone Error",
					description: "Could not access microphone.",
					variant: "destructive",
				});
				return;
			}
		}

		// Start recording when button is pressed
		await startManualRecording();
	};

	const handleRecordButtonUp = async () => {
		// Stop recording when button is released
		await stopManualRecording();
	};

	const handleRecordButtonLeave = async () => {
		// If user dragged away from button while holding, stop recording
		if (isRecording) {
			await stopManualRecording();
		}
	};

	useEffect(() => {
		return () => {
			stopListening();
			stopTranslationStream();
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		};
	}, [stopListening, stopTranslationStream]);

	return (
		<div className="h-[100dvh] w-full flex flex-col bg-[#0c0c0e] text-white overflow-hidden">
			<header className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
				<Link to="/">
					<button
						className="flex items-center gap-2  hover:text-white/70 transition-colors"
						data-testid="button-back"
					>
						<ArrowLeft className="w-4 h-4" />
						<span className="text-sm font-medium">PolyTalk</span>
					</button>
				</Link>

				<Link
					to="/mic-check"
					className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/40 hover:border-white/20 hover:text-white transition"
				>
					<MicVocal className="h-4 w-4" />
					Mic Check
				</Link>

				{/* {messages.length > 0 && (
					<button
						onClick={() => {
							setMessages([]);
							setLastDetectedSide(null);
							setStatus("idle");
							setWaveformData([]);
						}}
						className="p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
						title="Clear conversation"
						data-testid="button-clear"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
				)}
				{messages.length === 0 && <div className="w-8" />} */}
			</header>

			{/* ─── Language Cards ─── */}
			<div className="flex-shrink-0 px-4 pt-4 pb-3">
				<div className="flex items-stretch justify-center gap-3">
					<div>
						<LangCard
							label="A"
							lang={langA}
							onLangChange={setLangA}
							mic={micA}
							onMicChange={setMicA}
							speaker={speakerA}
							onSpeakerChange={setSpeakerA}
							mics={mics}
							speakers={speakers}
						/>
					</div>

					{/* Swap button */}
					<div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
						<button
							onClick={swapLanguages}
							className={`
				w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center
				text-white/30 hover:text-white/60 hover:bg-white/10 transition-all duration-200
				${swapping ? "rotate-180" : "rotate-0"} transition-transform duration-300
			  `}
							title="Swap languages"
							data-testid="button-swap-langs"
						>
							<ArrowLeftRight className="w-3.5 h-3.5" />
						</button>
					</div>

					<div>
						<LangCard
							label="B"
							lang={langB}
							onLangChange={setLangB}
							mic={micB}
							onMicChange={setMicB}
							speaker={speakerB}
							onSpeakerChange={setSpeakerB}
							mics={mics}
							speakers={speakers}
						/>
					</div>
				</div>

				{/* Hint */}
				<p className="mt-2.5 text-center text-[10px] text-white/50 leading-snug">
					Each person's mic &amp; speaker can be set independently
				</p>
			</div>

			{/* ─── Conversation Area ─── */}
			<div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
				{messages.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center gap-3 text-center">
						<div className="flex items-center gap-3 text-3xl opacity-60">
							<span>{getLangFlag(langA)}</span>
							<ArrowLeftRight className="w-4 h-4 text-white/50" />
							<span>{getLangFlag(langB)}</span>
						</div>
						<div>
							<p className="text-white/50 font-medium text-sm mb-1">
								{status === "processing"
									? "Translating..."
									: status === "recording"
										? `Listening to ${activeSide === "A" ? langA : langB}`
										: "Ready to translate"}
							</p>
							<p className="text-white/40 text-xs max-w-[220px] leading-relaxed">
								{liveTranscript || liveTranslation
									? `${liveTranscript}${liveTranslation ? ` -> ${liveTranslation}` : ""}`
									: `Tap the mic and speak in ${activeSide === "A" ? langA : langB}`}
							</p>
						</div>
					</div>
				) : (
					<div className="py-2">
						{messages.map((msg) => (
							<MessageBubble key={msg.id} msg={msg} />
						))}
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
							{[0, 150, 300].map((d) => (
								<span
									key={d}
									className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-bounce"
									style={{ animationDelay: `${d}ms` }}
								/>
							))}
							<span className="ml-2 uppercase tracking-widest">
								Translating
							</span>
						</div>
					)}
					{status === "idle" && (
						<div className="flex items-center justify-center gap-[3px] h-10">
							{IDLE_BAR_KEYS.map((key) => (
								<div
									key={key}
									className="w-[3px] h-1 rounded-full bg-white/[0.08]"
								/>
							))}
						</div>
					)}
				</div>

				{/* Hint */}
				<p className="text-[10px] text-white/50 uppercase tracking-widest h-3">
					{isRecording
						? "Release to send"
						: `Tap and hold to speak in ${activeSide === "A" ? langA : langB}`}
				</p>

				{/* Record button */}
				<button
					onMouseDown={handleRecordButtonDown}
					onMouseUp={handleRecordButtonUp}
					onMouseLeave={handleRecordButtonLeave}
					onTouchStart={handleRecordButtonDown}
					onTouchEnd={handleRecordButtonUp}
					disabled={false}
					data-testid="button-record"
					className={` cursor-pointer
			relative flex items-center justify-center w-[72px] h-[72px] rounded-full
			select-none touch-none transition-all duration-200 ease-out
			${
				status === "processing"
					? "opacity-30 cursor-not-allowed scale-90 bg-white/10"
					: isRecording
						? "scale-110 bg-rose-500 shadow-[0_0_0_10px_rgba(244,63,94,0.12),0_0_32px_rgba(244,63,94,0.25)]"
						: "bg-white hover:scale-[1.04] active:scale-95 shadow-[0_2px_32px_rgba(255,255,255,0.08)]"
			}
		  `}
				>
					{isRecording && (
						<span className="absolute inset-0 rounded-full border-2 border-rose-400 animate-ping opacity-40" />
					)}
					<Mic
						className={`w-7 h-7 ${isRecording ? "text-white" : "text-zinc-950"}`}
					/>
				</button>
			</div>

			{/* <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
				<div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
					<div className="border-b border-white/8 pb-4">
						<div className="flex flex-wrap items-center gap-3 px-1">
							{isConfigExpanded ? (
								<>
									<div className="min-w-0 flex-1 text-sm text-zinc-300">
										<span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-teal-200">
											{activeInputSide === "native"
												? `${getLanguageName(nativeLanguage)} active`
												: `${getLanguageName(secondaryLanguage)} active`}
										</span>
									</div>

									<div className="flex items-center gap-2">
										<button
											onClick={processTestAudio}
											className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition hover:border-white/20 hover:text-white"
										>
											Test Audio
										</button>
										<button
											type="button"
											onClick={() => setIsConfigExpanded(false)}
											className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition hover:border-white/20 hover:text-white"
										>
											Close
										</button>
									</div>
								</>
							) : (
								<>
									<Link
										to="/mic-check"
										className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition hover:border-white/20 hover:text-white"
									>
										Mic Check
									</Link>

									<div className="flex min-w-0 flex-1 items-center justify-center gap-3 text-sm">
										<span className="font-medium text-white">
											{getLanguageName(nativeLanguage)}
										</span>
										<ArrowLeftRight className="h-4 w-4 text-zinc-500" />
										<span className="font-medium text-white">
											{getLanguageName(secondaryLanguage)}
										</span>
									</div>

									<button
										type="button"
										onClick={() => setIsConfigExpanded(true)}
										className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition hover:border-white/20 hover:text-white"
									>
										Edit
									</button>
								</>
							)}
						</div>

						<div
							className={`grid transition-all duration-300 ease-out ${
								isConfigExpanded
									? "mt-3 grid-rows-[1fr] opacity-100"
									: "mt-0 grid-rows-[0fr] opacity-0"
							}`}
						>
							<div className="overflow-hidden">
								<div
									className={`rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,30,0.82),rgba(13,16,21,0.82))] p-3 shadow-[0_16px_44px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out ${
										isConfigExpanded ? "translate-y-0" : "-translate-y-2"
									}`}
								>
									<div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
										<DeviceSideCard
											title="Side A"
											accent="blue"
											isActive={activeInputSide === "native"}
											language={nativeLanguage}
											mic={nativeMic}
											speaker={nativeSpeaker}
											mics={mics}
											speakers={speakers}
											onActivate={() => setActiveInputSide("native")}
											onLanguageChange={setNativeLanguage}
											onMicChange={setNativeMic}
											onSpeakerChange={setNativeSpeaker}
										/>

										<div className="hidden items-center justify-center lg:flex">
											<div className="rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-zinc-400">
												<ArrowLeftRight className="h-4 w-4" />
											</div>
										</div>

										<DeviceSideCard
											title="Side B"
											accent="violet"
											isActive={activeInputSide === "secondary"}
											language={secondaryLanguage}
											mic={secondaryMic}
											speaker={secondarySpeaker}
											mics={mics}
											speakers={speakers}
											onActivate={() => setActiveInputSide("secondary")}
											onLanguageChange={setSecondaryLanguage}
											onMicChange={setSecondaryMic}
											onSpeakerChange={setSecondarySpeaker}
										/>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-10 text-center">
						<div className="flex flex-wrap items-center justify-center gap-2">
							{(isProcessingRef.current ||
								isStreaming ||
								isVoiceProcessing) && (
								<div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200">
									{isStreaming
										? "Streaming translation..."
										: isVoiceProcessing
											? "Processing voice..."
											: "Processing..."}
								</div>
							)}

							{detectedLanguage && !isProcessingRef.current && !isStreaming && (
								<div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300">
									{isUserSpeakingNative
										? `${getLanguageName(detectedLanguage)} -> ${getLanguageName(secondaryLanguage)}`
										: `${getLanguageName(detectedLanguage)} -> ${getLanguageName(nativeLanguage)}`}
								</div>
							)}
						</div>

						<div className="space-y-4">
							<button
								onClick={toggleListening}
								className={`flex h-32 w-32 items-center justify-center rounded-full transition-all duration-200 ${
									isListening
										? isVoiceDetected
											? "scale-110 bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.42)]"
											: "scale-105 bg-teal-500 shadow-[0_0_40px_rgba(20,184,166,0.32)]"
										: "bg-white shadow-[0_16px_44px_rgba(255,255,255,0.14)] hover:scale-105"
								}`}
							>
								{isListening ? (
									isVoiceDetected ? (
										<div className="h-20 w-20 rounded-full bg-red-600 animate-pulse" />
									) : (
										<Mic className="h-12 w-12 text-white" />
									)
								) : (
									<MicOff className="h-12 w-12 text-zinc-900" />
								)}
							</button>
						</div>

						<p className="text-base text-zinc-300">
							{isProcessingRef.current || isStreaming || isVoiceProcessing
								? "Translating"
								: isListening
									? "Listening"
									: "Tap to start listening"}
						</p>
					</div>
				</div>
			</div> */}
		</div>
	);
}
