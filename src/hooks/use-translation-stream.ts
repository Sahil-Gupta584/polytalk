import { useCallback, useRef, useState } from "react";

function base64ToFloat32Array(base64: string): Float32Array {
	const binary = atob(base64);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const pcm16 = new Int16Array(bytes.buffer);
	const float32 = new Float32Array(pcm16.length);
	for (let i = 0; i < pcm16.length; i++) {
		float32[i] = pcm16[i] / 32768;
	}
	return float32;
}

export function useTranslationStream() {
	const [isStreaming, setIsStreaming] = useState(false);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const nextPlayTimeRef = useRef<number>(0);

	const startStream = useCallback(
		async (
			audioBlob: Blob,
			nativeLanguage: string,
			secondaryLanguage: string | undefined,
			speakerId: string,
			onUserTranscript: (text: string) => void,
			onDetectedLanguage: (language: string, isUserNative: boolean) => void,
			onTranscript: (text: string) => void,
			onDone: () => void,
			onError: (err: Error) => void,
		) => {
			setIsStreaming(true);

			try {
				if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
					audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
				}
				const ctx = audioCtxRef.current;
				if (ctx.state === "suspended") await ctx.resume();

				if (
					speakerId &&
					speakerId !== "default" &&
					typeof (ctx as any).setSinkId === "function"
				) {
					try {
						await (ctx as any).setSinkId(speakerId);
					} catch (e) {
						console.warn("setSinkId failed or not permitted", e);
					}
				}

				nextPlayTimeRef.current = ctx.currentTime + 0.1;

				const reader = new FileReader();
				reader.readAsDataURL(audioBlob);

				reader.onloadend = async () => {
					try {
						const base64Audio = (reader.result as string).split(",")[1];

						const res = await fetch("/api/translate/audio", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								audio: base64Audio,
								nativeLanguage,
								secondaryLanguage: secondaryLanguage || null,
							}),
						});

						if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

						const data = await res.json();

						if (data.error) {
							throw new Error(data.error);
						}

						onUserTranscript(data.userTranscript);
						onDetectedLanguage(
							data.detectedLanguage,
							data.isUserSpeakingNative,
						);
						onTranscript(data.translatedText);

						if (data.audio) {
							const pcmFloat = base64ToFloat32Array(data.audio);
							const audioBuffer = ctx.createBuffer(1, pcmFloat.length, 24000);
							audioBuffer.getChannelData(0).set(pcmFloat);

							const source = ctx.createBufferSource();
							source.buffer = audioBuffer;
							source.connect(ctx.destination);

							const playTime = Math.max(
								ctx.currentTime,
								nextPlayTimeRef.current,
							);
							source.start(playTime);
							nextPlayTimeRef.current = playTime + audioBuffer.duration;
						}

						onDone();
					} catch (error) {
						onError(error instanceof Error ? error : new Error(String(error)));
					} finally {
						setIsStreaming(false);
					}
				};
			} catch (err) {
				onError(err instanceof Error ? err : new Error(String(err)));
				setIsStreaming(false);
			}
		},
		[],
	);

	return { startStream, isStreaming };
}
