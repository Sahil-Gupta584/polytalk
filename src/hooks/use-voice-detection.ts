import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceDetectionOptions {
	onVoiceStart?: () => void;
	onVoiceEnd?: (audioBlob: Blob) => void;
	silenceThreshold?: number;
	silenceDuration?: number;
	onLevelChange?: (level: number) => void;
	mode?: "auto" | "manual"; // "auto" = voice detection, "manual" = tap and hold
	paddingDuration?: number; // duration in ms to pad audio with silence at the end
}

export function useVoiceDetection({
	onVoiceStart,
	onVoiceEnd,
	silenceThreshold = 0.01,
	silenceDuration = 1500,
	onLevelChange,
	mode = "auto",
	paddingDuration = 2000, // 2 seconds of padding by default
}: UseVoiceDetectionOptions) {
	const [isListening, setIsListening] = useState(false);
	const [isVoiceDetected, setIsVoiceDetected] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isRecording, setIsRecording] = useState(false);

	const mediaStreamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyzerRef = useRef<AnalyserNode | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const animationFrameRef = useRef<number | null>(null);
	const silenceTimeoutRef = useRef<number | null>(null);
	const speechStableRef = useRef<number | null>(null);
	const recordingStartTimeRef = useRef<number | null>(null);
	const audioContextForPaddingRef = useRef<AudioContext | null>(null);

	// Add silence padding to audio blob
	const addAudioPadding = useCallback(
		async (audioBlob: Blob): Promise<Blob> => {
			if (paddingDuration <= 0) {
				return audioBlob;
			}

			try {
				const arrayBuffer = await audioBlob.arrayBuffer();
				const audioContext = new AudioContext();
				audioContextForPaddingRef.current = audioContext;

				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
				const sampleRate = audioBuffer.sampleRate;
				const paddingFrames = (paddingDuration / 1000) * sampleRate;

				// Create a new audio buffer with the original + padding
				const paddedAudioBuffer = audioContext.createBuffer(
					audioBuffer.numberOfChannels,
					audioBuffer.length + Math.round(paddingFrames),
					sampleRate,
				);

				// Copy original audio
				for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
					const sourceData = audioBuffer.getChannelData(i);
					const targetData = paddedAudioBuffer.getChannelData(i);
					targetData.set(sourceData);
					// Remaining frames are already zeroed (silent)
				}

				// Convert to blob
				const offlineContext = new OfflineAudioContext(
					audioBuffer.numberOfChannels,
					paddedAudioBuffer.length,
					sampleRate,
				);
				const source = offlineContext.createBufferSource();
				source.buffer = paddedAudioBuffer;
				source.connect(offlineContext.destination);
				source.start(0);

				const renderedBuffer = await offlineContext.startRendering();

				// Convert AudioBuffer back to Blob
				const numberOfChannels = renderedBuffer.numberOfChannels;
				const sampleLength = renderedBuffer.length * numberOfChannels * 2 + 44;
				const arrayBufferNew = new ArrayBuffer(sampleLength);
				const view = new DataView(arrayBufferNew);

				// WAV header
				const writeString = (offset: number, string: string) => {
					for (let i = 0; i < string.length; i++) {
						view.setUint8(offset + i, string.charCodeAt(i));
					}
				};

				writeString(0, "RIFF");
				view.setUint32(4, 36 + renderedBuffer.length * 2, true);
				writeString(8, "WAVE");
				writeString(12, "fmt ");
				view.setUint32(16, 16, true);
				view.setUint16(20, 1, true);
				view.setUint16(22, numberOfChannels, true);
				view.setUint32(24, sampleRate, true);
				view.setUint32(28, sampleRate * 2 * numberOfChannels, true);
				view.setUint16(32, numberOfChannels * 2, true);
				view.setUint16(34, 16, true);
				writeString(36, "data");
				view.setUint32(40, renderedBuffer.length * 2, true);

				let index = 44;
				const volume = 0.8;
				for (let i = 0; i < renderedBuffer.length; i++) {
					for (let channel = 0; channel < numberOfChannels; channel++) {
						const sample = Math.max(-1, Math.min(1, renderedBuffer.getChannelData(channel)[i])) * volume;
						view.setInt16(
							index,
							sample < 0 ? sample * 0x8000 : sample * 0x7fff,
							true,
						);
						index += 2;
					}
				}

				return new Blob([arrayBufferNew], { type: "audio/wav" });
			} catch (error) {
				console.error("Failed to add audio padding:", error);
				return audioBlob;
			}
		},
		[paddingDuration],
	);

	// Start manual recording (for tap and hold mode)
	const startManualRecording = useCallback(async () => {
		if (isRecording || !isListening) return;

		recordingStartTimeRef.current = performance.now();
		setIsRecording(true);
		onVoiceStart?.();

		const stream = mediaStreamRef.current;

		if (stream) {
			const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? "audio/webm;codecs=opus"
				: MediaRecorder.isTypeSupported("audio/webm")
					? "audio/webm"
					: "";
			const recorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;
			chunksRef.current = [];

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunksRef.current.push(e.data);
				}
			};

			recorder.onstop = async () => {
				const blob = new Blob(chunksRef.current, {
					type: recorder.mimeType || "audio/webm",
				});
				if (chunksRef.current.length > 0) {
					const paddedBlob = await addAudioPadding(blob);
					onVoiceEnd?.(paddedBlob);
				}
				chunksRef.current = [];
				setIsRecording(false);
			};

			recorder.start();
		}
	}, [isRecording, isListening, onVoiceStart, onVoiceEnd, addAudioPadding]);

	// Stop manual recording (for tap and hold mode)
	const stopManualRecording = useCallback(async () => {
		if (!isRecording) return;

		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== "inactive"
		) {
			mediaRecorderRef.current.stop();
		}
	}, [isRecording]);

	const startListening = useCallback(async (micId?: string) => {
		try {
			const constraints: MediaStreamConstraints = {
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			};
			if (micId && micId !== "default") {
				constraints.audio = {
					deviceId: { exact: micId },
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				};
			}

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			mediaStreamRef.current = stream;

			const audioContext = new AudioContext();
			audioContextRef.current = audioContext;

			const source = audioContext.createMediaStreamSource(stream);
			const analyzer = audioContext.createAnalyser();
			analyzer.fftSize = 256;
			analyzer.smoothingTimeConstant = 0.8;
			source.connect(analyzer);
			analyzerRef.current = analyzer;

			setIsListening(true);
		} catch (err) {
			console.error("Failed to start voice detection:", err);
			throw err;
		}
	}, []);

	const stopListening = useCallback(() => {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}
		if (silenceTimeoutRef.current) {
			clearTimeout(silenceTimeoutRef.current);
		}
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== "inactive"
		) {
			mediaRecorderRef.current.stop();
		}
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((t) => {
				t.stop();
			});
		}
		if (audioContextRef.current) {
			audioContextRef.current.close();
		}
		if (audioContextForPaddingRef.current) {
			audioContextForPaddingRef.current.close();
		}

		mediaStreamRef.current = null;
		audioContextRef.current = null;
		audioContextForPaddingRef.current = null;
		analyzerRef.current = null;
		mediaRecorderRef.current = null;
		chunksRef.current = [];
		recordingStartTimeRef.current = null;

		setIsListening(false);
		setIsVoiceDetected(false);
		setIsRecording(false);
	}, []);

	const detectVoice = useCallback(() => {
		if (mode === "manual") {
			// In manual mode, just monitor levels without auto-detecting
			if (!analyzerRef.current || !isListening) {
				if (isListening) {
					animationFrameRef.current = requestAnimationFrame(detectVoice);
				}
				return;
			}

			const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
			analyzerRef.current.getByteFrequencyData(dataArray);

			const average =
				Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length / 255;

			onLevelChange?.(average);

			animationFrameRef.current = requestAnimationFrame(detectVoice);
			return;
		}

		// Auto detection mode (original behavior)
		if (!analyzerRef.current || !isListening || isProcessing) {
			if (isListening) {
				animationFrameRef.current = requestAnimationFrame(detectVoice);
			}
			return;
		}

		const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
		analyzerRef.current.getByteFrequencyData(dataArray);

		const average =
			Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length / 255;

		onLevelChange?.(average);

		const now = performance.now();
		if (average > silenceThreshold) {
			if (!speechStableRef.current) {
				speechStableRef.current = now;
			}
		} else {
			speechStableRef.current = null;
		}

		const stableEnough =
			speechStableRef.current &&
			now - speechStableRef.current >= 150 &&
			average > silenceThreshold;

		if (stableEnough && !isVoiceDetected && !isProcessing) {
			setIsVoiceDetected(true);
			onVoiceStart?.();

			const stream = mediaStreamRef.current;

			if (stream) {
				const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
					? "audio/webm;codecs=opus"
					: MediaRecorder.isTypeSupported("audio/webm")
						? "audio/webm"
						: "";
				const recorder = mimeType
					? new MediaRecorder(stream, { mimeType })
					: new MediaRecorder(stream);
				mediaRecorderRef.current = recorder;
				chunksRef.current = [];

				recorder.ondataavailable = (e) => {
					if (e.data.size > 0) {
						chunksRef.current.push(e.data);
					}
				};

				recorder.onstop = async () => {
					const blob = new Blob(chunksRef.current, {
						type: recorder.mimeType || "audio/webm",
					});
					if (chunksRef.current.length > 0) {
						const paddedBlob = await addAudioPadding(blob);
						onVoiceEnd?.(paddedBlob);
					}
					chunksRef.current = [];
				};

				recorder.start();
			}

			if (silenceTimeoutRef.current) {
				clearTimeout(silenceTimeoutRef.current);
			}
		} else if (
			average < silenceThreshold &&
			isVoiceDetected &&
			mediaRecorderRef.current
		) {
			if (silenceTimeoutRef.current) {
				clearTimeout(silenceTimeoutRef.current);
			}

			silenceTimeoutRef.current = window.setTimeout(() => {
				if (
					mediaRecorderRef.current &&
					mediaRecorderRef.current.state !== "inactive"
				) {
					mediaRecorderRef.current.stop();
				}
				setIsVoiceDetected(false);
			}, silenceDuration);
		}

		animationFrameRef.current = requestAnimationFrame(detectVoice);
	}, [
		mode,
		isListening,
		isVoiceDetected,
		isProcessing,
		silenceThreshold,
		silenceDuration,
		onVoiceStart,
		onVoiceEnd,
		onLevelChange,
		addAudioPadding,
	]);

	useEffect(() => {
		if (isListening && !isProcessing) {
			detectVoice();
		}
		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isListening, isProcessing, detectVoice]);

	return {
		isListening,
		isVoiceDetected,
		isProcessing,
		isRecording,
		setIsProcessing,
		startListening,
		stopListening,
		startManualRecording,
		stopManualRecording,
	};
}
