import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceDetectionOptions {
	onVoiceStart?: () => void;
	onVoiceEnd?: (audioBlob: Blob) => void;
	silenceThreshold?: number;
	silenceDuration?: number;
	onLevelChange?: (level: number) => void;
}

export function useVoiceDetection({
	onVoiceStart,
	onVoiceEnd,
	silenceThreshold = 0.01,
	silenceDuration = 1500,
	onLevelChange,
}: UseVoiceDetectionOptions) {
	const [isListening, setIsListening] = useState(false);
	const [isVoiceDetected, setIsVoiceDetected] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);

	const mediaStreamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyzerRef = useRef<AnalyserNode | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const animationFrameRef = useRef<number | null>(null);
	const silenceTimeoutRef = useRef<number | null>(null);
	const speechStableRef = useRef<number | null>(null);

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

		mediaStreamRef.current = null;
		audioContextRef.current = null;
		analyzerRef.current = null;
		mediaRecorderRef.current = null;
		chunksRef.current = [];

		setIsListening(false);
		setIsVoiceDetected(false);
	}, []);

	const detectVoice = useCallback(() => {
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

				recorder.onstop = () => {
					const blob = new Blob(chunksRef.current, {
						type: recorder.mimeType || "audio/webm",
					});
					if (chunksRef.current.length > 0) {
						onVoiceEnd?.(blob);
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
		isListening,
		isVoiceDetected,
		isProcessing,
		silenceThreshold,
		silenceDuration,
		onVoiceStart,
		onVoiceEnd,
		onLevelChange,
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
		setIsProcessing,
		startListening,
		stopListening,
	};
}
