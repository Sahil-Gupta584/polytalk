import { useCallback, useRef, useState } from "react";

function getAudioExtension(mimeType: string) {
	if (mimeType.includes("mpeg")) return "mp3";
	if (mimeType.includes("mp4")) return "mp4";
	if (mimeType.includes("ogg")) return "ogg";
	if (mimeType.includes("wav")) return "wav";
	return "webm";
}

export function useTranslationStream() {
	const [isStreaming, setIsStreaming] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const startStream = useCallback(
		async (
			audioBlob: Blob,
			nativeLanguage: string,
			secondaryLanguage: string,
			onUserTranscript: (text: string) => void,
			onDetectedLanguage: (language: string, isUserNative: boolean) => void,
			onTranscript: (text: string) => void,
			onDone: (result: {
				userTranscript: string;
				translatedText: string;
				detectedLanguage: string;
				isUserSpeakingNative: boolean;
			}) => void,
			onError: (err: Error) => void,
		) => {
			setIsStreaming(true);

			try {
				const formData = new FormData();
				const audioFile =
					audioBlob instanceof File
						? audioBlob
						: new File(
								[audioBlob],
								`recording.${getAudioExtension(audioBlob.type || "audio/webm")}`,
								{
									type: audioBlob.type || "audio/webm",
								},
							);
				formData.append("audio", audioFile);
				formData.append("nativeLanguage", nativeLanguage);
				formData.append("secondaryLanguage", secondaryLanguage);

				const abortController = new AbortController();
				abortControllerRef.current = abortController;

				const res = await fetch("/api/translate/audio/stream", {
					method: "POST",
					body: formData,
					signal: abortController.signal,
				});

				if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
				if (!res.body) throw new Error("Streaming response body is missing");

				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const events = buffer.split("\n\n");
					buffer = events.pop() || "";

					for (const rawEvent of events) {
						const lines = rawEvent.split("\n");
						const eventLine = lines.find((line) => line.startsWith("event: "));
						const dataLine = lines.find((line) => line.startsWith("data: "));
						if (!eventLine || !dataLine) continue;

						const eventName = eventLine.slice(7);
						const data = JSON.parse(dataLine.slice(6));

						if (eventName === "transcript.delta") {
							onUserTranscript(data.text);
						}

						if (eventName === "transcript.final") {
							onUserTranscript(data.text);
							onDetectedLanguage(
								data.detectedLanguage,
								data.isUserSpeakingNative,
							);
						}

						if (
							eventName === "translation.delta" ||
							eventName === "translation.final"
						) {
							onTranscript(data.text);
						}

						if (eventName === "done") {
							onUserTranscript(data.userTranscript);
							onDetectedLanguage(
								data.detectedLanguage,
								data.isUserSpeakingNative,
							);
							onTranscript(data.translatedText);
							onDone(data);
						}

						if (eventName === "error") {
							throw new Error(data.message || "Streaming translation failed");
						}
					}
				}
			} catch (err) {
				onError(err instanceof Error ? err : new Error(String(err)));
			} finally {
				abortControllerRef.current = null;
				setIsStreaming(false);
			}
		},
		[],
	);

	const stopStream = useCallback(() => {
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		setIsStreaming(false);
	}, []);

	return { startStream, stopStream, isStreaming };
}
