import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import speech from "@google-cloud/speech";
import { createFileRoute } from "@tanstack/react-router";
import LanguageDetect from "languagedetect";
import { storage } from "#/db/storage";
import { detectAudioFormat } from "#/lib/audio";
import { env } from "#/lib/env";
import { codeToName, translateText } from "#/lib/translation/client";

const defaultLocales: Record<string, string> = {
	en: "en-US",
	hi: "hi-IN",
	fr: "fr-FR",
	de: "de-DE",
	es: "es-ES",
	pt: "pt-BR",
	zh: "zh-CN",
};

export function langToLocale(lang: string) {
	const userLocale = navigator.languages?.[0] || navigator.language || "en-US";
	const langPrefix = lang.toLowerCase().split("-")[0];

	if (userLocale.toLowerCase().startsWith(langPrefix)) {
		return userLocale;
	}

	return defaultLocales[langPrefix] || `${langPrefix}-US`;
}
const languageDetector = new LanguageDetect();

function detectLanguageFromTranscript(
	transcript: string,
	candidateLanguages: string[],
): string {
	const results = languageDetector.detect(transcript, 12) as [string, number][];
	const normalizedCandidates = new Set(
		candidateLanguages.map((lang) => codeToName(lang).toLowerCase()),
	);

	const filtered = results
		.filter(([lang]) => normalizedCandidates.has(lang.toLowerCase()))
		.sort((a, b) => b[1] - a[1]);

	const detected =
		filtered[0]?.[0]?.toLowerCase() ||
		codeToName(candidateLanguages[0] || "en");
	const detectedCode = candidateLanguages.find(
		(lang) => codeToName(lang).toLowerCase() === detected,
	);
	return detectedCode || candidateLanguages[0] || "en";
}

function createSseEvent(event: string, data: unknown) {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getAudioExtension(mimeType: string, detectedFormat: string) {
	if (detectedFormat !== "unknown") {
		return detectedFormat;
	}

	const normalizedMimeType = mimeType.toLowerCase();
	if (normalizedMimeType.includes("mpeg")) return "mp3";
	if (normalizedMimeType.includes("mp4")) return "mp4";
	if (normalizedMimeType.includes("ogg")) return "ogg";
	if (normalizedMimeType.includes("wav")) return "wav";
	return "webm";
}

async function persistDebugAudio(args: {
	audioBuffer: Buffer;
	mimeType: string;
	detectedFormat: string;
	reason: string;
}) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const extension = getAudioExtension(args.mimeType, args.detectedFormat);
	const fileName = `debug-${args.reason}-${timestamp}.${extension}`;
	const filePath = resolve(process.cwd(), "public", fileName);

	await writeFile(filePath, args.audioBuffer);

	console.log("[audio stream] debug audio saved", {
		reason: args.reason,
		fileName,
		filePath,
		audioBytes: args.audioBuffer.length,
		mimeType: args.mimeType || "unknown",
		detectedFormat: args.detectedFormat,
	});

	return { fileName, filePath };
}

function getErrorMessage(error: unknown) {
	if (
		typeof error === "object" &&
		error !== null &&
		"error" in error &&
		typeof error.error === "object" &&
		error.error !== null &&
		"message" in error.error &&
		typeof error.error.message === "string"
	) {
		return error.error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "Streaming translation failed";
}

const serviceAccountPath = resolve(
	process.cwd(),
	env.GOOGLE_SERVICE_ACCOUNT_FILE,
);
const sttClient = existsSync(serviceAccountPath)
	? new speech.v2.SpeechClient({
			keyFilename: serviceAccountPath,
		})
	: null;

async function transcribeWithGoogle(
	audioBuffer: Buffer,
	languageCodes: string[],
) {
	if (!env.GOOGLE_CLOUD_PROJECT_ID) {
		throw new Error(
			"Google STT is not configured. Set GOOGLE_CLOUD_PROJECT_ID.",
		);
	}

	if (!sttClient) {
		throw new Error(
			`Google STT service account file not found at ${serviceAccountPath}`,
		);
	}

	console.log("[google stt] recognize request", {
		languageCodes,
		audioBytes: audioBuffer.length,
		projectId: env.GOOGLE_CLOUD_PROJECT_ID,
		recognizer: `projects/${env.GOOGLE_CLOUD_PROJECT_ID}/locations/global/recognizers/_`,
	});

	const [response] = await sttClient.recognize({
		recognizer: `projects/${env.GOOGLE_CLOUD_PROJECT_ID}/locations/global/recognizers/_`,
		config: {
			autoDecodingConfig: {},
			languageCodes,
			model: "short",
		},
		content: audioBuffer,
	});

	const transcript = response.results
		?.flatMap((result) => result.alternatives || [])
		.map((alternative) => alternative.transcript || "")
		.join(" ")
		.trim();

	console.log("[google stt] recognize response", {
		languageCodes,
		resultCount: response.results?.length || 0,
		transcriptLength: transcript.length,
	});

	if (!transcript) {
		console.error("[google stt] empty transcript", {
			languageCodes,
			resultCount: response.results?.length || 0,
		});
		return "";
	}

	return transcript;
}

export const Route = createFileRoute("/api/translate/audio/stream")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const formData = await request.formData();
					const audioFile = formData.get("audio") as File | null;
					const nativeLanguage = formData.get("nativeLanguage") as
						| string
						| null;
					const secondaryLanguage = formData.get("secondaryLanguage") as
						| string
						| null;

					if (!audioFile || !nativeLanguage || !secondaryLanguage) {
						return new Response(
							JSON.stringify({
								error:
									"Missing required fields: audio, nativeLanguage, secondaryLanguage, nativeLocale, secondaryLocale",
							}),
							{ status: 400 },
						);
					}

					const arrayBuffer = await audioFile.arrayBuffer();
					const audioBuffer = Buffer.from(arrayBuffer);
					const detectedFormat = detectAudioFormat(audioBuffer);
					const audioMimeType = audioFile.type || "unknown";
					const languageCodes = [
						langToLocale(nativeLanguage),
						langToLocale(secondaryLanguage),
					];
					console.log("[audio stream] request received", {
						fileName: audioFile.name || "unnamed",
						mimeType: audioMimeType,
						audioBytes: audioBuffer.length,
						detectedFormat,
						nativeLanguage,
						secondaryLanguage,
						languageCodes,
					});

					if (detectedFormat === "unknown") {
						console.error("[audio stream] unsupported audio format", {
							fileName: audioFile.name || "unnamed",
							mimeType: audioFile.type || "unknown",
							audioBytes: audioBuffer.length,
						});
						return new Response(
							JSON.stringify({
								error:
									"Recorded audio format is not recognized. Try again in Chrome/Edge, or use a different microphone/browser.",
								mimeType: audioFile.type || "unknown",
								size: audioBuffer.length,
							}),
							{ status: 415 },
						);
					}

					const stream = new ReadableStream({
						start(controller) {
							const encoder = new TextEncoder();
							const enqueue = (event: string, data: unknown) => {
								controller.enqueue(encoder.encode(createSseEvent(event, data)));
							};

							void (async () => {
								try {
									const userTranscript = await transcribeWithGoogle(
										audioBuffer,
										languageCodes,
									);

									if (!userTranscript) {
										await persistDebugAudio({
											audioBuffer,
											mimeType: audioMimeType,
											detectedFormat,
											reason: "empty-transcript",
										});
										console.log("[audio stream] no transcript returned", {
											languageCodes,
										});
										enqueue("done", {
											userTranscript: "",
											translatedText: "",
											detectedLanguage: nativeLanguage,
											isUserSpeakingNative: true,
										});
										controller.close();
										return;
									}

									enqueue("transcript.delta", { text: userTranscript });

									const detectedLanguage = detectLanguageFromTranscript(
										userTranscript,
										[nativeLanguage, secondaryLanguage],
									);
									console.log("[audio stream] transcript resolved", {
										userTranscript,
										detectedLanguage,
										nativeLanguage,
										secondaryLanguage,
									});
									const sourceLanguage = detectedLanguage;
									const targetLanguage =
										detectedLanguage === nativeLanguage
											? secondaryLanguage
											: nativeLanguage;
									const isUserSpeakingNative =
										detectedLanguage === nativeLanguage;

									enqueue("transcript.final", {
										text: userTranscript,
										detectedLanguage,
										isUserSpeakingNative,
									});

									if (!targetLanguage || targetLanguage === sourceLanguage) {
										console.log("[audio stream] skipping translation", {
											sourceLanguage,
											targetLanguage,
										});
										enqueue("translation.final", {
											text: userTranscript,
										});
										enqueue("done", {
											userTranscript,
											translatedText: userTranscript,
											detectedLanguage,
											isUserSpeakingNative,
										});
										controller.close();
										return;
									}

									const translatedText = await translateText(
										userTranscript,
										nativeLanguage,
										targetLanguage,
									);
									console.log("[audio stream] translation complete", {
										sourceLanguage,
										targetLanguage,
										translatedLength: translatedText.length,
									});

									enqueue("translation.final", {
										text: translatedText,
									});
									enqueue("done", {
										userTranscript,
										translatedText,
										detectedLanguage,
										isUserSpeakingNative,
									});

									void storage
										.createTranslation({
											sourceLanguage,
											targetLanguage,
											sourceText: userTranscript,
											translatedText,
										})
										.catch((storageError) => {
											console.error(
												"[audio stream] failed to store translation",
												storageError,
											);
										});

									console.log("[audio stream] completed", {
										userTranscriptLength: userTranscript.length,
										translatedLength: translatedText.length,
									});
									controller.close();
								} catch (error) {
									console.error("[audio stream] failed", error);
									enqueue("error", {
										message: getErrorMessage(error),
									});
									controller.close();
								}
							})();
						},
					});

					return new Response(stream, {
						headers: {
							"Content-Type": "text/event-stream",
							"Cache-Control": "no-cache, no-transform",
							Connection: "keep-alive",
						},
					});
				} catch (error) {
					console.error("[audio stream] request setup failed", error);
					return new Response(
						JSON.stringify({ error: "Streaming translation failed" }),
						{ status: 500 },
					);
				}
			},
		},
	},
});
