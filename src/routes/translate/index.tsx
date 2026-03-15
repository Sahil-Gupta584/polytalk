import { createFileRoute, Link } from "@tanstack/react-router";
import langs from "langs";
import { ArrowLeftRight, Mic, MicOff, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDevices } from "@/hooks/use-devices";
import { useToast } from "@/hooks/use-toast";
import { useTranslationStream } from "@/hooks/use-translation-stream";
import { useVoiceDetection } from "@/hooks/use-voice-detection";

const LANGUAGES = langs.codes("1");
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function getLanguageName(code: string): string {
	return LANGUAGE_NAMES.of(code) || code.toUpperCase();
}

function getFallbackSecondaryLanguage(nativeLanguage: string) {
	return LANGUAGES.find((language) => language !== nativeLanguage) || "";
}

function langToLocale(lang: string) {
	const userLocale = navigator.languages?.[0] || navigator.language || "en-US";
	const langPrefix = lang.toLowerCase().split("-")[0];
	return userLocale.startsWith(langPrefix)
		? userLocale
		: `${lang.toLowerCase()}-US`;
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
	)
}

export const Route = createFileRoute("/translate/")({
	component: Translation,
});

export default function Translation() {
	const { toast } = useToast();
	const { mics, speakers, hasPermission, requestPermission } = useDevices();

	const [isConfigExpanded, setIsConfigExpanded] = useState(false);
	const [nativeLanguage, setNativeLanguage] = useState("en");
	const [secondaryLanguage, setSecondaryLanguage] = useState("hi");
	const [activeInputSide, setActiveInputSide] = useState<
		"native" | "secondary"
	>("native");
	const [nativeMic, setNativeMic] = useState("default");
	const [secondaryMic, setSecondaryMic] = useState("default");
	const [nativeSpeaker, setNativeSpeaker] = useState("default");
	const [secondarySpeaker, setSecondarySpeaker] = useState("default");
	const [_userText, setUserText] = useState("");
	const [_translatedText, setTranslatedText] = useState("");
	const [detectedLanguage, setDetectedLanguage] = useState("");
	const [isUserSpeakingNative, setIsUserSpeakingNative] = useState(true);
	const [availableVoices, setAvailableVoices] = useState<
		SpeechSynthesisVoice[]
	>([]);

	const isProcessingRef = useRef(false);
	const ttsRequestIdRef = useRef(0);
	const {
		isStreaming,
		startStream,
		stopStream: stopTranslationStream,
	} = useTranslationStream();
	const {
		isListening,
		isVoiceDetected,
		isProcessing: isVoiceProcessing,
		setIsProcessing: setIsVoiceProcessing,
		startListening,
		stopListening,
	} = useVoiceDetection({
		onVoiceStart: () => {
			setUserText("Listening...");
		},
		onVoiceEnd: (audioBlob) => {
			processAudio(audioBlob);
		},
	});

	useEffect(() => {
		if (secondaryLanguage === nativeLanguage) {
			setSecondaryLanguage(getFallbackSecondaryLanguage(nativeLanguage));
		}
	}, [nativeLanguage, secondaryLanguage]);

	useEffect(() => {
		if (!nativeMic && mics[0]?.deviceId) {
			setNativeMic(mics[0].deviceId);
		}
		if (!secondaryMic && mics[0]?.deviceId) {
			setSecondaryMic(mics[0].deviceId);
		}
	}, [mics, nativeMic, secondaryMic]);

	useEffect(() => {
		if (!nativeSpeaker && speakers[0]?.deviceId) {
			setNativeSpeaker(speakers[0].deviceId);
		}
		if (!secondarySpeaker && speakers[0]?.deviceId) {
			setSecondarySpeaker(speakers[0].deviceId);
		}
	}, [speakers, nativeSpeaker, secondarySpeaker]);

	useEffect(() => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			return
		}

		const loadVoices = () => {
			setAvailableVoices(window.speechSynthesis.getVoices());
		}

		loadVoices();
		window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

		return () => {
			window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
		}
	}, []);

	const getVoices = async () => {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			return [] as SpeechSynthesisVoice[];
		}

		const existingVoices = window.speechSynthesis.getVoices();
		if (existingVoices.length > 0) {
			return existingVoices;
		}

		return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
			const timeoutId = window.setTimeout(() => {
				window.speechSynthesis.removeEventListener(
					"voiceschanged",
					handleVoicesChanged,
				)
				resolve(window.speechSynthesis.getVoices());
			}, 1000);

			const handleVoicesChanged = () => {
				window.clearTimeout(timeoutId);
				window.speechSynthesis.removeEventListener(
					"voiceschanged",
					handleVoicesChanged,
				)
				resolve(window.speechSynthesis.getVoices());
			}

			window.speechSynthesis.addEventListener(
				"voiceschanged",
				handleVoicesChanged,
			)
		})
	}

	const processTestAudio = async () => {
		if (isProcessingRef.current) return;

		try {
			const res = await fetch("/ttsreader_life-is-si.mp3");
			const blob = await res.blob();
			const file = new File([blob], "ttsreader_life-is-si.mp3", {
				type: "audio/mp3",
			})
			await processAudio(file);
		} catch (err) {
			console.error("Error loading test audio:", err);
			toast({
				title: "Test Error",
				description: "Failed to load test audio file.",
				variant: "destructive",
			})
		}
	}

	const processAudio = async (audioFile: File | Blob) => {
		if (isProcessingRef.current) return;

		if (
			!nativeLanguage ||
			!secondaryLanguage ||
			nativeLanguage === secondaryLanguage
		) {
			toast({
				title: "Language Setup Required",
				description:
					"Select both primary and secondary languages before recording.",
				variant: "destructive",
			})
			return
		}

		isProcessingRef.current = true;
		setIsVoiceProcessing(true);

		try {
			setUserText("Processing...");
			setTranslatedText("");
			setDetectedLanguage("");

			await startStream(
				audioFile,
				nativeLanguage,
				secondaryLanguage,
				(text) => {
					setUserText(text || "Processing...");
				},
				(language, isUserNative) => {
					setDetectedLanguage(language);
					setIsUserSpeakingNative(isUserNative);
					setActiveInputSide(isUserNative ? "secondary" : "native");
				},
				(text) => {
					setTranslatedText(text);
				},
				(result) => {
					if (!result.userTranscript.trim()) {
						setUserText("No speech detected.");
						setTranslatedText("");
						return
					}

					if (result.translatedText.trim()) {
						void playTranslatedAudio(
							result.translatedText,
							result.detectedLanguage,
						)
					}
				},
				(err) => {
					console.error("Error processing audio:", err);
					toast({
						title: "Translation Failed",
						description: err.message,
						variant: "destructive",
					})
					setUserText("Failed.");
					setTranslatedText("Error");
				},
			)
		} catch (err) {
			console.error("Error processing audio:", err);
			toast({
				title: "Translation Failed",
				description:
					err instanceof Error ? err.message : "Failed to process audio",
				variant: "destructive",
			})
			setUserText("Failed.");
			setTranslatedText("Error");
		} finally {
			isProcessingRef.current = false;
			setIsVoiceProcessing(false);
		}
	}

	const playTranslatedAudio = async (
		text: string,
		sourceLanguage: string = detectedLanguage,
	) => {
		if (!text.trim()) return;

		const requestId = ++ttsRequestIdRef.current;

		try {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) {
				return
			}

			window.speechSynthesis.cancel();

			if (requestId !== ttsRequestIdRef.current) {
				return
			}

			const utterance = new SpeechSynthesisUtterance(text);
			const voices = (
				availableVoices.length ? availableVoices : await getVoices()
			) as SpeechSynthesisVoice[];
			const targetSide =
				sourceLanguage === nativeLanguage ? "secondary" : "native";
			const targetLanguage =
				targetSide === "native" ? nativeLanguage : secondaryLanguage;
			const targetSpeaker =
				targetSide === "native" ? nativeSpeaker : secondarySpeaker;
			const preferredVoice =
				voices.find((voice) =>
					voice.lang
						.toLowerCase()
						.startsWith(`${targetLanguage.toLowerCase()}-`),
				) ||
				voices.find(
					(voice) => voice.lang.toLowerCase() === targetLanguage.toLowerCase(),
				)
			const fallbackVoice =
				voices.find((voice) => voice.default) || voices[0] || null;
			const selectedVoice = preferredVoice || fallbackVoice;

			if (selectedVoice) {
				utterance.voice = selectedVoice;
				utterance.lang = selectedVoice.lang;
			} else {
				utterance.lang = langToLocale(targetLanguage);
			}

			const shouldUseBrowserVoice = voiceMatchesLanguage(
				selectedVoice,
				targetLanguage,
			)

			if (!shouldUseBrowserVoice || targetSpeaker !== "default") {
				const res = await fetch("/api/translate/audio/tts", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						text,
						languageCode: langToLocale(targetLanguage),
					}),
				})

				if (!res.ok) {
					throw new Error(`Google TTS failed with status ${res.status}`);
				}

				const data = (await res.json()) as { audio?: string };
				if (!data.audio) {
					throw new Error("Google TTS returned no audio");
				}

				const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
				if (
					targetSpeaker !== "default" &&
					typeof (
						audio as HTMLAudioElement & {
							setSinkId?: (id: string) => Promise<void>;
						}
					).setSinkId === "function"
				) {
					await (
						audio as HTMLAudioElement & {
							setSinkId: (id: string) => Promise<void>;
						}
					).setSinkId(targetSpeaker);
				}
				await audio.play();
				return
			}

			utterance.rate = 0.95;
			utterance.volume = 1;
			utterance.pitch = 1;

			utterance.onstart = () => {
				console.log("Speech synthesis started", {
					text,
					lang: utterance.lang,
					voice: utterance.voice?.name || "default",
				})
			}
			utterance.onend = () => {
				if (ttsRequestIdRef.current === requestId) {
					ttsRequestIdRef.current = 0;
				}
			}
			utterance.onerror = (event) => {
				console.error("Speech synthesis failed:", event);
			}

			window.speechSynthesis.resume();
			window.speechSynthesis.speak(utterance);
		} catch (error) {
			console.error("Error playing translated audio:", error);
		}
	}

	const toggleListening = async () => {
		if (isListening) {
			stopListening();
			return
		}

		if (!secondaryLanguage || nativeLanguage === secondaryLanguage) {
			toast({
				title: "Language Setup Required",
				description: "Choose two different languages before recording.",
				variant: "destructive",
			})
			return
		}

		try {
			if (!hasPermission) {
				await requestPermission();
			}

			const activeMic = activeInputSide === "native" ? nativeMic : secondaryMic;
			await startListening(activeMic);
		} catch {
			toast({
				title: "Microphone Error",
				description: "Could not access microphone.",
				variant: "destructive",
			})
		}
	}

	useEffect(() => {
		return () => {
			stopListening();
			stopTranslationStream();
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		}
	}, [stopListening, stopTranslationStream]);

	return (
		<div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(61,90,122,0.12),transparent_30%),linear-gradient(180deg,#121316_0%,#0b0d10_100%)] font-sans">
			<div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
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
			</div>
		</div>
	)
}

type DeviceSideCardProps = {
	title: string;
	accent: "blue" | "violet";
	isActive: boolean;
	language: string;
	mic: string;
	speaker: string;
	mics: MediaDeviceInfo[];
	speakers: MediaDeviceInfo[];
	onActivate: () => void;
	onLanguageChange: (value: string) => void;
	onMicChange: (value: string) => void;
	onSpeakerChange: (value: string) => void;
};

function DeviceSideCard({
	title,
	accent,
	isActive,
	language,
	mic,
	speaker,
	mics,
	speakers,
	onActivate,
	onLanguageChange,
	onMicChange,
	onSpeakerChange,
}: DeviceSideCardProps) {
	const accentClass =
		accent === "blue"
			? "border-teal-400/20 bg-teal-400/10 text-teal-200"
			: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
	const iconClass = accent === "blue" ? "text-teal-300" : "text-cyan-300";

	return (
		<button
			type="button"
			onClick={onActivate}
			className={`rounded-[24px] border p-4 text-left transition ${
				isActive
					? "border-white/14 bg-white/[0.07] shadow-[0_18px_42px_rgba(0,0,0,0.16)]"
					: "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
			}`}
		>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div
						className={`h-2.5 w-2.5 rounded-full ${
							accent === "blue" ? "bg-teal-300" : "bg-cyan-300"
						}`}
					/>
					<p className="text-sm font-medium text-white">
						{title} ({getLanguageName(language)})
					</p>
				</div>
				{isActive && (
					<div
						className={`rounded-full border px-3 py-1 text-xs ${accentClass}`}
					>
						Active
					</div>
				)}
			</div>

			<div className="mb-3">
				<select
					value={language}
					onChange={(event) => {
						event.stopPropagation();
						onLanguageChange(event.target.value);
					}}
					className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/20"
				>
					{LANGUAGES.map((lang) => (
						<option key={lang} value={lang} className="bg-zinc-900">
							{getLanguageName(lang)}
						</option>
					))}
				</select>
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
					<div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
						<Mic className={`h-4 w-4 ${iconClass}`} />
						Input
					</div>
					<select
						value={mic}
						onChange={(event) => {
							event.stopPropagation();
							onMicChange(event.target.value);
						}}
						className="w-full bg-transparent text-sm font-medium text-white outline-none"
					>
						<option value="default" className="bg-zinc-900">
							Default microphone
						</option>
						{mics.map((device) => (
							<option
								key={device.deviceId}
								value={device.deviceId}
								className="bg-zinc-900"
							>
								{device.label || "Microphone"}
							</option>
						))}
					</select>
				</div>

				<div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
					<div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
						<Volume2 className={`h-4 w-4 ${iconClass}`} />
						Output
					</div>
					<select
						value={speaker}
						onChange={(event) => {
							event.stopPropagation();
							onSpeakerChange(event.target.value);
						}}
						className="w-full bg-transparent text-sm font-medium text-white outline-none"
					>
						<option value="default" className="bg-zinc-900">
							Default speaker
						</option>
						{speakers.map((device) => (
							<option
								key={device.deviceId}
								value={device.deviceId}
								className="bg-zinc-900"
							>
								{device.label || "Speaker"}
							</option>
						))}
					</select>
				</div>
			</div>
		</button>
	)
}
