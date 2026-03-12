import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	Globe2,
	History,
	Mic,
	MicOff,
	Settings,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { HistoryModal } from "@/components/HistoryModal";
import { useToast } from "@/hooks/use-toast";
import { useCreateTranslation } from "@/hooks/use-translations";
import { useVoiceDetection } from "@/hooks/use-voice-detection";

const LANGUAGES = [
	"English",
	"Japanese",
	"Spanish",
	"French",
	"German",
	"Chinese",
	"Korean",
	"Italian",
	"Portuguese",
	"Russian",
	"Arabic",
	"Hindi",
];

export const Route = createFileRoute("/translation")({
	component: Translation,
});

export default function Translation() {
	const [, setLocation] = useLocation();
	const { toast } = useToast();
	const createTranslation = useCreateTranslation();

	const [showHistory, setShowHistory] = useState(false);
	const [showSettings, setShowSettings] = useState(false);

	const [nativeLanguage, setNativeLanguage] = useState("English");
	const [secondaryLanguage, setSecondaryLanguage] = useState("hi");
	const [secondaryLanguageEnabled, setSecondaryLanguageEnabled] =
		useState(false);


	const [userText, setUserText] = useState("");
	const [translatedText, setTranslatedText] = useState("");
	const [detectedLanguage, setDetectedLanguage] = useState("");
	const [isUserSpeakingNative, setIsUserSpeakingNative] = useState(true);

	const finalUserRef = useRef("");
	const finalTransRef = useRef("");
	const detectedLangRef = useRef("");
	const isUserNativeRef = useRef(true);
	const isProcessingRef = useRef(false);

	const processAudio = async (audioBlob: Blob) => {
		if (isProcessingRef.current) return;
		isProcessingRef.current = true;

		try {
			setUserText("Processing...");
			setTranslatedText("");

			await new Promise<void>((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = async () => {
					try {
						const base64Audio = (reader.result as string).split(",")[1];

						const res = await fetch("/api/translate/audio", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								audio: base64Audio,
								nativeLanguage,
								secondaryLanguage
							}),
						});

						if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

						const data = await res.json();

						if (data.error) {
							throw new Error(data.error);
						}

						setUserText(data.userTranscript);
						finalUserRef.current = data.userTranscript;

						setDetectedLanguage(data.detectedLanguage);
						setIsUserSpeakingNative(data.isUserSpeakingNative);
						detectedLangRef.current = data.detectedLanguage;
						isUserNativeRef.current = data.isUserSpeakingNative;

						setTranslatedText(data.translatedText);
						finalTransRef.current = data.translatedText;

						if (data.userTranscript && data.translatedText) {
							const targetLang = data.isUserSpeakingNative
								? secondaryLanguageEnabled
									? secondaryLanguage
									: "detected"
								: nativeLanguage;

							createTranslation.mutate({
								sourceLanguage: data.detectedLanguage || nativeLanguage,
								targetLanguage: targetLang,
								sourceText: data.userTranscript,
								translatedText: data.translatedText,
							});
						}

						resolve();
					} catch (err) {
						reject(err);
					}
				};
				reader.onerror = () => reject(new Error("Failed to read audio"));
				reader.readAsDataURL(audioBlob);
			});
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

	const {
		isListening,
		isVoiceDetected,
		isProcessing,
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

	const toggleListening = async () => {
		if (isListening) {
			stopListening();
		} else {
			try {
				await startListening();
			} catch (err) {
				toast({
					title: "Microphone Error",
					description: "Could not access microphone.",
					variant: "destructive",
				});
			}
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
						<div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-full">
							<Globe2 className="w-4 h-4 text-emerald-400" />
							<span className="text-sm font-medium text-white">
								{nativeLanguage}
							</span>
						</div>
						{secondaryLanguageEnabled && secondaryLanguage && (
							<span className="text-zinc-500">→</span>
						)}
						{secondaryLanguageEnabled && secondaryLanguage && (
							<div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-full">
								<Zap className="w-4 h-4 text-amber-400" />
								<span className="text-sm font-medium text-white">
									{secondaryLanguage}
								</span>
							</div>
						)}
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() => setShowSettings(!showSettings)}
							className={`p-2 rounded-full transition-colors ${
								showSettings
									? "bg-zinc-700 text-white"
									: "text-zinc-400 hover:text-white"
							}`}
						>
							<Settings className="w-5 h-5" />
						</button>
						<button
							onClick={() => setShowHistory(true)}
							className="p-2 text-zinc-400 hover:text-white transition-colors"
						>
							<History className="w-5 h-5" />
						</button>
					</div>
				</div>

				{showSettings && (
					<div className="bg-zinc-800/50 border-b border-zinc-700 p-4 space-y-4">
						<div>
							<label
								htmlFor="native-language"
								className="block text-sm font-medium text-zinc-300 mb-2"
							>
								Your Native Language
							</label>
							<select
								id="native-language"
								value={nativeLanguage}
								onChange={(e) => setNativeLanguage(e.target.value)}
								className="w-full bg-zinc-900 text-white rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
							>
								{LANGUAGES.map((lang) => (
									<option key={lang} value={lang}>
										{lang}
									</option>
								))}
							</select>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex-1">
								<label
									htmlFor="secondary-language"
									className="block text-sm font-medium text-zinc-300 mb-2"
								>
									Secondary Language (Optional)
								</label>
								<select
									id="secondary-language"
									value={secondaryLanguage}
									onChange={(e) => setSecondaryLanguage(e.target.value)}
									disabled={!secondaryLanguageEnabled}
									className="w-full bg-zinc-900 text-white rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
								>
									<option value="">Select language</option>
									{LANGUAGES.filter((l) => l !== nativeLanguage).map((lang) => (
										<option key={lang} value={lang}>
											{lang}
										</option>
									))}
								</select>
							</div>
							<button
								onClick={() => {
									setSecondaryLanguageEnabled(!secondaryLanguageEnabled);
									if (!secondaryLanguageEnabled) setSecondaryLanguage("");
								}}
								className={`ml-3 mt-6 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
									secondaryLanguageEnabled
										? "bg-amber-500/20 text-amber-400 border border-amber-500"
										: "bg-zinc-700 text-zinc-300 border border-zinc-600"
								}`}
							>
								<Zap className="w-4 h-4" />
							</button>
						</div>
						<p className="text-xs text-zinc-500">
							{secondaryLanguageEnabled
								? "Fast mode: Only translates between your two selected languages"
								: "Auto-detect: Automatically detects input language and translates to your native language"}
						</p>
					</div>
				)}

				<div className="flex-1 flex flex-col items-center justify-center p-6">
					{isProcessing && (
						<div className="mb-6 px-4 py-2 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
							Processing...
						</div>
					)}

					{detectedLanguage && !isProcessing && (
						<div
							className={`mb-6 px-4 py-2 rounded-full text-sm font-medium ${
								isUserSpeakingNative
									? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
									: "bg-blue-500/20 text-blue-400 border border-blue-500/30"
							}`}
						>
							{isUserSpeakingNative
								? `You spoke ${detectedLanguage} → Translating to ${
										secondaryLanguageEnabled ? secondaryLanguage : "..."
									}`
								: `${detectedLanguage} detected → Translating to ${nativeLanguage}`}
						</div>
					)}

					<div className="w-full max-w-xl mb-6">
						<div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
							You said
						</div>
						<div className="bg-zinc-800/50 rounded-2xl p-4 min-h-[80px] text-lg text-white">
							{userText || "Start listening and speak"}
						</div>
					</div>

					<div className="w-full max-w-xl mb-8">
						<div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
							{isUserSpeakingNative && detectedLanguage
								? "Translation"
								: detectedLanguage
									? `Translated to ${nativeLanguage}`
									: "Translation"}
						</div>
						<div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-2xl p-4 min-h-[80px] text-xl font-medium text-white border border-zinc-700">
							{translatedText || "..."}
						</div>
					</div>

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
