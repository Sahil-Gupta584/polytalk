import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mic, Play, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDevices } from "@/hooks/use-devices";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";

export const Route = createFileRoute("/mic-check")({
	component: MicCheck,
});

function MicCheck() {
	const { toast } = useToast();
	const { mics, speakers, hasPermission, requestPermission } = useDevices();
	const [selectedMic, setSelectedMic] = useState("default");
	const [selectedSpeaker, setSelectedSpeaker] = useState("default");
	const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

	useEffect(() => {
		if (!selectedMic && mics[0]?.deviceId) {
			setSelectedMic(mics[0].deviceId);
		}
	}, [mics, selectedMic]);

	useEffect(() => {
		if (!selectedSpeaker && speakers[0]?.deviceId) {
			setSelectedSpeaker(speakers[0].deviceId);
		}
	}, [speakers, selectedSpeaker]);

	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
			}
			if (lastRecordingUrl) {
				URL.revokeObjectURL(lastRecordingUrl);
			}
		};
	}, [lastRecordingUrl]);

	const playAudio = async (url: string) => {
		const audio = new Audio(url);
		audioRef.current = audio;
		audio.onended = () => setIsPlaying(false);
		audio.onerror = () => {
			setIsPlaying(false);
			toast({
				title: "Playback Failed",
				description: "Could not play the recorded audio.",
				variant: "destructive",
			});
		};

		if (
			selectedSpeaker &&
			selectedSpeaker !== "default" &&
			typeof (
				audio as HTMLAudioElement & {
					setSinkId?: (id: string) => Promise<void>;
				}
			).setSinkId === "function"
		) {
			try {
				await (
					audio as HTMLAudioElement & {
						setSinkId: (id: string) => Promise<void>;
					}
				).setSinkId(selectedSpeaker);
			} catch (error) {
				console.error("Failed to set audio output device:", error);
			}
		}

		setIsPlaying(true);
		await audio.play();
	};

	const handleRecordToggle = async () => {
		console.log({hasPermission});
		
		if (!hasPermission) {
			await requestPermission();
		}

		if (!isRecording) {
			try {
				if (lastRecordingUrl) {
					URL.revokeObjectURL(lastRecordingUrl);
					setLastRecordingUrl(null);
				}
				await startRecording(selectedMic);
			} catch {
				toast({
					title: "Microphone Error",
					description:
						"Could not start recording from the selected microphone.",
					variant: "destructive",
				});
			}
			return;
		}

		const blob = await stopRecording();
		if (!blob) {
			return;
		}

		const url = URL.createObjectURL(blob);
		setLastRecordingUrl(url);

		try {
			await playAudio(url);
		} catch (error) {
			console.error("Failed to play recorded audio:", error);
			toast({
				title: "Playback Failed",
				description: "The recording completed, but playback failed.",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="min-h-[100dvh] bg-zinc-950 text-white">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
				<div className="flex items-center justify-between">
					<Link
						to="/translate"
						className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
					>
						<ArrowLeft className="h-4 w-4" />
						Back To Translation
					</Link>
					<div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
						Mic Check
					</div>
				</div>

				<div className="space-y-3">
					<h1 className="text-3xl font-semibold tracking-tight">
						Check your mic and speaker
					</h1>
					<p className="max-w-2xl text-sm text-zinc-400">
						Choose the input and output device, record a short sample, and hear
						the same recording back through the selected speaker.
					</p>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<label className="space-y-2">
						<span className="text-sm text-zinc-400">Input device</span>
						<select
							value={selectedMic}
							onChange={(e) => setSelectedMic(e.target.value)}
							className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
						>
							<option value="default">Default microphone</option>
							{mics.map((mic) => (
								<option key={mic.deviceId} value={mic.deviceId}>
									{mic.label || "Microphone"}
								</option>
							))}
						</select>
					</label>

					<label className="space-y-2">
						<span className="text-sm text-zinc-400">Output device</span>
						<select
							value={selectedSpeaker}
							onChange={(e) => setSelectedSpeaker(e.target.value)}
							className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500"
						>
							<option value="default">Default speaker</option>
							{speakers.map((speaker) => (
								<option key={speaker.deviceId} value={speaker.deviceId}>
									{speaker.label || "Speaker"}
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
					<div className="flex flex-col items-center gap-5 text-center">
						<div
							className={`flex h-28 w-28 items-center justify-center rounded-full transition ${
								isRecording
									? "bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.35)]"
									: "bg-white text-zinc-900 shadow-[0_14px_40px_rgba(255,255,255,0.12)]"
							}`}
						>
							{isRecording ? (
								<Square className="h-10 w-10" />
							) : (
								<Mic className="h-10 w-10" />
							)}
						</div>

						<div className="space-y-1">
							<p className="text-lg font-medium">
								{isRecording ? "Recording..." : "Ready to test"}
							</p>
							<p className="text-sm text-zinc-400">
								{isRecording
									? "Speak a few sentences, then tap again to stop and replay."
									: "Tap the button, speak, then tap again to hear playback."}
							</p>
						</div>

						<div className="flex flex-wrap items-center justify-center gap-3">
							<button
								type="button"
								onClick={handleRecordToggle}
								className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
							>
								{isRecording ? "Stop And Replay" : "Start Mic Check"}
							</button>
						</div>

						{lastRecordingUrl && (
							<div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
								<p className="mb-3 text-sm text-zinc-400">Last recording</p>
								<audio controls src={lastRecordingUrl} className="w-full">
									<track
										kind="captions"
										src="data:text/vtt,WEBVTT"
										srcLang="en"
										label="No captions available"
									/>
								</audio>
							</div>
						)}
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
						<div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800">
							<Mic className="h-4 w-4 text-emerald-400" />
						</div>
						<p className="text-sm font-medium">Mic check</p>
						<p className="mt-1 text-sm text-zinc-400">
							Use this to confirm the selected microphone captures your voice.
						</p>
					</div>

					<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
						<div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800">
							<Volume2 className="h-4 w-4 text-amber-400" />
						</div>
						<p className="text-sm font-medium">Speaker check</p>
						<p className="mt-1 text-sm text-zinc-400">
							Playback is routed to the chosen output device when the browser
							supports `setSinkId`.
						</p>
					</div>

					<div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
						<div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800">
							<Play className="h-4 w-4 text-sky-400" />
						</div>
						<p className="text-sm font-medium">Replay</p>
						<p className="mt-1 text-sm text-zinc-400">
							Recordings replay immediately so you can verify clarity and output
							routing.
						</p>
					</div>
				</div>

				{isPlaying && (
					<div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-200">
						Playing recorded audio through the selected output device.
					</div>
				)}
			</div>
		</div>
	);
}
