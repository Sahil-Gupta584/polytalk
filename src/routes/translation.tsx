import { createFileRoute, Link } from "@tanstack/react-router";
import langs from "langs";
import {
	ArrowDownUp,
	ArrowLeft,
	Globe2,
	History,
	Mic,
	MicOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HistoryModal } from "@/components/HistoryModal";
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
	// Use user's first preferred language's locale, fallback to common defaults
	const userLocale = navigator.languages?.[0] || navigator.language || "en-US";
	const langPrefix = lang.toLowerCase().split("-")[0]; // Extract base lang (e.g., 'en')
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
	);
}

export const Route = createFileRoute("/translation")({
	component: Translation,
});

export default function Translation() {
	const { toast } = useToast();

	const [showHistory, setShowHistory] = useState(false);

	const [nativeLanguage, setNativeLanguage] = useState("en");
	const [secondaryLanguage, setSecondaryLanguage] = useState("hi");

	const [userText, setUserText] = useState("");
	const [translatedText, setTranslatedText] = useState("");
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
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			return;
		}

		const loadVoices = () => {
			setAvailableVoices(window.speechSynthesis.getVoices());
		};

		loadVoices();
		window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

		return () => {
			window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
		};
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
				);
				resolve(window.speechSynthesis.getVoices());
			}, 1000);

			const handleVoicesChanged = () => {
				window.clearTimeout(timeoutId);
				window.speechSynthesis.removeEventListener(
					"voiceschanged",
					handleVoicesChanged,
				);
				resolve(window.speechSynthesis.getVoices());
			};

			window.speechSynthesis.addEventListener(
				"voiceschanged",
				handleVoicesChanged,
			);
		});
	};

	const processTestAudio = async () => {
		if (isProcessingRef.current) return;

		try {
			const res = await fetch("/ttsreader_life-is-si.mp3");
			const blob = await res.blob();
			const file = new File([blob], "ttsreader_life-is-si.mp3", {
				type: "audio/mp3",
			});
			await processAudio(file);
		} catch (err) {
			console.error("Error loading test audio:", err);
			toast({
				title: "Test Error",
				description: "Failed to load test audio file.",
				variant: "destructive",
			});
		}
	};

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
			});
			return;
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
				},
				(text) => {
					setTranslatedText(text);
				},
				(result) => {
					if (result.translatedText.trim()) {
						void playTranslatedAudio(result.translatedText);
					}
				},
				(err) => {
					console.error("Error processing audio:", err);
					toast({
						title: "Translation Failed",
						description: err.message,
						variant: "destructive",
					});
					setUserText("Failed.");
					setTranslatedText("Error");
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
			setUserText("Failed.");
			setTranslatedText("Error");
		} finally {
			isProcessingRef.current = false;
			setIsVoiceProcessing(false);
		}
	};

	const playTranslatedAudio = async (text: string) => {
		if (!text.trim()) return;

		const requestId = ++ttsRequestIdRef.current;

		try {
			if (typeof window === "undefined" || !("speechSynthesis" in window)) {
				return;
			}

			window.speechSynthesis.cancel();

			if (requestId !== ttsRequestIdRef.current) {
				return;
			}
			const utterance = new SpeechSynthesisUtterance(text);
			const voices = (
				availableVoices.length ? availableVoices : await getVoices()
			) as SpeechSynthesisVoice[];
			const preferredVoice =
				voices.find((voice) =>
					voice.lang
						.toLowerCase()
						.startsWith(`${secondaryLanguage.toLowerCase()}-`),
				) ||
				voices.find(
					(voice) =>
						voice.lang.toLowerCase() === secondaryLanguage.toLowerCase(),
				);
			const fallbackVoice =
				voices.find((voice) => voice.default) || voices[0] || null;
			const selectedVoice = preferredVoice || fallbackVoice;

			if (selectedVoice) {
				utterance.voice = selectedVoice;
				utterance.lang = selectedVoice.lang;
			} else {
				utterance.lang = langToLocale(secondaryLanguage);
			}

			const shouldUseBrowserVoice = voiceMatchesLanguage(
				selectedVoice,
				secondaryLanguage,
			);

			if (!shouldUseBrowserVoice) {
				const res = await fetch("/api/translate/audio/tts", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						text,
						languageCode: langToLocale(secondaryLanguage),
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
				await audio.play();
				return;
			}

			utterance.rate = 0.95;
			utterance.volume = 1;
			utterance.pitch = 1;

			utterance.onstart = () => {
				console.log("Speech synthesis started", {
					text,
					lang: utterance.lang,
					voice: utterance.voice?.name || "default",
				});
			};
			utterance.onend = () => {
				if (ttsRequestIdRef.current === requestId) {
					ttsRequestIdRef.current = 0;
				}
			};
			utterance.onerror = (event) => {
				console.error("Speech synthesis failed:", event);
			};

			window.speechSynthesis.resume();
			window.speechSynthesis.speak(utterance);
		} catch (error) {
			console.error("Error playing translated audio:", error);
		}
	};

	const toggleListening = async () => {
		if (isListening) {
			stopListening();
			return;
		}

		if (!secondaryLanguage || nativeLanguage === secondaryLanguage) {
			toast({
				title: "Language Setup Required",
				description: "Choose two different languages before recording.",
				variant: "destructive",
			});
			return;
		}

		try {
			await startListening();
		} catch {
			toast({
				title: "Microphone Error",
				description: "Could not access microphone.",
				variant: "destructive",
			});
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
		<>
			<div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 font-sans">
				<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
					<Link to="/">
						<button className="text-zinc-400 hover:text-white transition-colors">
							<ArrowLeft className="w-6 h-6" />
						</button>
					</Link>

					<div className="flex items-center gap-2">
						<select
							value={nativeLanguage}
							onChange={(e) => setNativeLanguage(e.target.value)}
							className="bg-zinc-800 text-sm font-medium text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
						>
							{LANGUAGES.map((lang) => (
								<option key={lang} value={lang} className="bg-zinc-800">
									{getLanguageName(lang)}
								</option>
							))}
						</select>
						<ArrowDownUp className="w-4 h-4 text-zinc-500 rotate-90" />
						<select
							value={secondaryLanguage}
							onChange={(e) => setSecondaryLanguage(e.target.value)}
							className="bg-zinc-800 text-sm font-medium text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
						>
							{LANGUAGES.filter((lang) => lang !== nativeLanguage).map(
								(lang) => (
									<option key={lang} value={lang} className="bg-zinc-800">
										{getLanguageName(lang)}
									</option>
								),
							)}
						</select>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() => setShowHistory(true)}
							className="p-2 text-zinc-400 hover:text-white transition-colors"
						>
							<History className="w-5 h-5" />
						</button>
					</div>
				</div>

				<div className="flex-1 flex flex-col items-center justify-center p-6">
					{(isProcessingRef.current || isStreaming || isVoiceProcessing) && (
						<div className="mb-6 px-4 py-2 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
							{isStreaming
								? "Streaming translation..."
								: isVoiceProcessing
									? "Processing voice..."
									: "Processing..."}
						</div>
					)}

					{detectedLanguage && !isProcessingRef.current && !isStreaming && (
						<div
							className={`mb-6 px-4 py-2 rounded-full text-sm font-medium ${
								isUserSpeakingNative
									? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
									: "bg-amber-500/20 text-amber-400 border border-amber-500/30"
							}`}
						>
							{isUserSpeakingNative
								? `You spoke ${getLanguageName(detectedLanguage)} → Translating to ${getLanguageName(secondaryLanguage)}`
								: `${getLanguageName(detectedLanguage)} detected → Translating to ${getLanguageName(nativeLanguage)}`}
						</div>
					)}

					<div className="w-full flex items-center justify-center gap-4 mb-8">
						<div className="flex-1">
							<div className="flex items-center justify-center gap-2 mb-2">
								<Globe2 className="w-4 h-4 text-emerald-400" />
								<span className="text-xs text-zinc-500 uppercase tracking-wider">
									{getLanguageName(nativeLanguage)}
								</span>
							</div>
							<div className="bg-zinc-800/50 rounded-2xl p-4 min-h-[80px] text-lg text-white text-center">
								{userText || "Your speech..."}
							</div>
						</div>

						<div className="flex flex-col items-center justify-center">
							<div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
								<ArrowDownUp className="w-5 h-5 rotate-90 text-zinc-500" />
							</div>
						</div>

						<div className="flex-1">
							<div className="flex items-center justify-center gap-2 mb-2">
								<Globe2 className="w-4 h-4 text-amber-400" />
								<span className="text-xs text-zinc-500 uppercase tracking-wider">
									{getLanguageName(secondaryLanguage)}
								</span>
							</div>
							<div className="bg-gradient-to-r from-emerald-500/10 to-amber-500/10 rounded-2xl p-4 min-h-[80px] text-xl font-medium text-white text-center border border-zinc-700">
								{translatedText || "Translation..."}
							</div>
						</div>
					</div>

					<button
						onClick={processTestAudio}
						className="mb-4 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
					>
						Test Audio
					</button>
					<button
						onClick={toggleListening}
						className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
							isListening
								? isVoiceDetected
									? "bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.5)]"
									: "bg-emerald-500 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
								: "bg-white hover:scale-105 shadow-[0_8px_30px_rgba(255,255,255,0.2)]"
						}`}
					>
						{isListening ? (
							isVoiceDetected ? (
								<div className="w-16 h-16 rounded-full bg-red-600 animate-pulse" />
							) : (
								<Mic className="w-10 h-10 text-white" />
							)
						) : (
							<MicOff className="w-10 h-10 text-zinc-900" />
						)}
					</button>
					<p className="mt-4 text-sm text-zinc-500">
						{isProcessingRef.current || isStreaming || isVoiceProcessing
							? "Translating"
							: isListening
								? "Listening"
								: "Tap to start listening"}
					</p>
				</div>
			</div>

			<HistoryModal
				isOpen={showHistory}
				onClose={() => setShowHistory(false)}
			/>
		</>
	);
}
