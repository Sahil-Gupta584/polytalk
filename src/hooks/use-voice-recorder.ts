import { useCallback, useRef, useState } from "react";

export function useVoiceRecorder(onWaveformUpdate?: (data: number[]) => void) {
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const analyzerRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);

	const startRecording = useCallback(
		async (micId?: string) => {
			try {
				const constraints: MediaStreamConstraints = { audio: true };

				if (micId && micId !== "default") {
					constraints.audio = { deviceId: { exact: micId } };
				}

				const stream = await navigator.mediaDevices.getUserMedia(constraints);
				streamRef.current = stream;

				const recorder = new MediaRecorder(stream, {
					mimeType: "audio/webm;codecs=opus",
				});

				// Set up Web Audio API for waveform visualization
				const audioContext = new AudioContext();
				const source = audioContext.createMediaStreamSource(stream);
				const analyzer = audioContext.createAnalyser();
				analyzer.fftSize = 256;
				source.connect(analyzer);
				analyzerRef.current = analyzer;

				chunksRef.current = [];
				recorder.ondataavailable = (e) => {
					if (e.data.size > 0) chunksRef.current.push(e.data);
				};

				// Capture waveform data
				const captureWaveform = () => {
					if (!analyzerRef.current || !onWaveformUpdate) return;

					const dataArray = new Uint8Array(
						analyzerRef.current.frequencyBinCount,
					);
					analyzerRef.current.getByteFrequencyData(dataArray);

					// Average the frequency data for a smoother waveform
					const average =
						Array.from(dataArray).reduce((a, b) => a + b) /
						dataArray.length /
						255;
					onWaveformUpdate([average]);

					animationFrameRef.current = requestAnimationFrame(captureWaveform);
				};

				recorder.start(100);
				mediaRecorderRef.current = recorder;
				setIsRecording(true);

				if (onWaveformUpdate) {
					captureWaveform();
				}
			} catch (err) {
				console.error("Failed to start recording:", err);
				throw err;
			}
		},
		[onWaveformUpdate],
	);

	const stopRecording = useCallback((): Promise<Blob | null> => {
		return new Promise((resolve) => {
			const recorder = mediaRecorderRef.current;
			if (!recorder || recorder.state !== "recording") {
				resolve(null);
				return;
			}

			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: "audio/webm" });
				recorder.stream.getTracks().forEach((t) => {
					t.stop();
				});

				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
				}

				if (analyzerRef.current) {
					analyzerRef.current.disconnect();
					analyzerRef.current = null;
				}

				setIsRecording(false);
				resolve(blob);
			};

			recorder.stop();
		});
	}, []);

	return { isRecording, startRecording, stopRecording };
}
