import { createFileRoute } from "@tanstack/react-router";
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
import { useLocation } from "wouter";
import { HistoryModal } from "@/components/HistoryModal";
import { useToast } from "@/hooks/use-toast";
import { useVoiceDetection } from "@/hooks/use-voice-detection";

const LANGUAGES = langs.codes("1");

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function getLanguageName(code: string): string {
	return LANGUAGE_NAMES.of(code) || code.toUpperCase();
}

function getFallbackSecondaryLanguage(nativeLanguage: string) {
	return LANGUAGES.find((language) => language !== nativeLanguage) || "";
}

export const Route = createFileRoute("/translation")({
	component: Translation,
});

export default function Translation() {
	const [, setLocation] = useLocation();
	const { toast } = useToast();

	const [showHistory, setShowHistory] = useState(false);

	const [nativeLanguage, setNativeLanguage] = useState("en");
	const [secondaryLanguage, setSecondaryLanguage] = useState("ja");

	const [userText, setUserText] = useState("");
	const [translatedText, setTranslatedText] = useState("");
	const [detectedLanguage, setDetectedLanguage] = useState("");
	const [isUserSpeakingNative, setIsUserSpeakingNative] = useState(true);

	const isProcessingRef = useRef(false);

	useEffect(() => {
		if (secondaryLanguage === nativeLanguage) {
			setSecondaryLanguage(getFallbackSecondaryLanguage(nativeLanguage));
		}
	}, [nativeLanguage, secondaryLanguage]);

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

		try {
			setUserText("Processing...");
			setTranslatedText("");

			const formData = new FormData();
			formData.append("audio", audioFile);
			formData.append("nativeLanguage", nativeLanguage);
			formData.append("secondaryLanguage", secondaryLanguage);

			const res = await fetch("/api/translate/audio", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				throw new Error(`HTTP error! status: ${res.status}`);
			}

			const data = await res.json();

			if (data.error) {
				throw new Error(data.error);
			}

			setUserText(data.userTranscript);
			setDetectedLanguage(data.detectedLanguage);
			setIsUserSpeakingNative(data.isUserSpeakingNative);
			setTranslatedText(data.translatedText);
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
		}
	};

	const { isListening, isVoiceDetected, startListening, stopListening } =
		useVoiceDetection({
			onVoiceStart: () => {
				setUserText("Listening...");
			},
			onVoiceEnd: (audioBlob) => {
				processAudio(audioBlob);
			},
		});

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
		};
	}, [stopListening]);

	return (
		<>
			<div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 font-sans">
				<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
					<button
						onClick={() => setLocation("/")}
						className="text-zinc-400 hover:text-white transition-colors"
					>
						<ArrowLeft className="w-6 h-6" />
					</button>

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
					{isProcessingRef.current && (
						<div className="mb-6 px-4 py-2 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
							Processing...
						</div>
					)}

					{detectedLanguage && !isProcessingRef.current && (
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
						{isListening
							? isVoiceDetected
								? "Listening... speak now"
								: "Listening for voice..."
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
