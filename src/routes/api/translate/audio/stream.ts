import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import speech from "@google-cloud/speech";
import { createFileRoute } from "@tanstack/react-router";
import LanguageDetect from "languagedetect";
import { storage } from "#/db/storage";
import { detectAudioFormat } from "#/lib/audio";
import { env } from "#/lib/env";
import {
	codeToName,
	detectLanguageFromTranscript,
	translateText,
} from "#/lib/translation/client";

const defaultLocales: Record<string, string> = {
	en: "en-US",
	hi: "hi-IN",
	fr: "fr-FR",
	de: "de-DE",
	es: "es-ES",
	pt: "pt-BR",
	zh: "zh-CN",
	ja: "ja-JP",
	ko: "ko-KR",
	ru: "ru-RU",
	it: "it-IT",
	ar: "ar-SA",
	tr: "tr-TR",
	nl: "nl-NL",
	sv: "sv-SE",
	pl: "pl-PL",
	id: "id-ID",
	vi: "vi-VN",
	th: "th-TH",
	bn: "bn-BD",
	ur: "ur-PK",
	ms: "ms-MY",
	tl: "tl-PH",
	el: "el-GR",
};

export function langToLocale(lang: string) {
	const langPrefix = lang.toLowerCase().split("-")[0];

	return defaultLocales[langPrefix] || `${langPrefix}-US`;
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
	const filePath = resolve(process.cwd(), "public", "failed-audios", fileName);

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
const speechEndpoint = `${env.GOOGLE_STT_REGION}-speech.googleapis.com`;
const sttClient = existsSync(serviceAccountPath)
	? new speech.v2.SpeechClient({
			keyFilename: serviceAccountPath,
			apiEndpoint: speechEndpoint,
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

	const sttModel = env.GOOGLE_STT_MODEL || "short";
	const recognizerPath = `projects/${env.GOOGLE_CLOUD_PROJECT_ID}/locations/${env.GOOGLE_STT_REGION}/recognizers/_`;
	console.log("[google stt] recognize request", {
		model: sttModel,
		region: env.GOOGLE_STT_REGION,
	});

	const [response] = await sttClient.recognize({
		recognizer: recognizerPath,
		config: {
			autoDecodingConfig: {},
			languageCodes,
			model: sttModel,
		},
		content: audioBuffer,
	});

	const transcript = response.results
		?.flatMap((result) => result.alternatives || [])
		.map((alternative) => alternative.transcript || "")
		.join(" ")
		.trim();

	console.log("[google stt] recognize response", {
		resultCount: response.results?.length || 0,
		transcriptLength: transcript?.length,
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
					const primaryLang = formData.get("primaryLanguage") as string | null;
					const secondaryLanguage = formData.get("secondaryLanguage") as
						| string
						| null;

					if (!audioFile || !primaryLang || !secondaryLanguage) {
						console.log({primaryLang,secondaryLanguage});
						
						return new Response(
							JSON.stringify({
								error:
									"Missing required fields: audio, primaryLang, secondaryLanguage, nativeLocale, secondaryLocale",
							}),
							{ status: 400 },
						);
					}

					const arrayBuffer = await audioFile.arrayBuffer();
					const audioBuffer = Buffer.from(arrayBuffer);
					const detectedFormat = detectAudioFormat(audioBuffer);
					const audioMimeType = audioFile.type || "unknown";
					const languageCodes = [
						langToLocale(primaryLang),
						langToLocale(secondaryLanguage),
					];
					console.log("[audio stream] request received", {
						sizeKB: (audioBuffer.length / 1024).toFixed(1),
						primaryLang,
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
							let isClosed = false;

							const enqueue = (event: string, data: unknown) => {
								if (isClosed) return;
								try {
									controller.enqueue(encoder.encode(createSseEvent(event, data)));
								} catch (e) {
									isClosed = true;
								}
							};

							const closeStream = () => {
								if (isClosed) return;
								try {
									controller.close();
								} catch (e) {
									// ignore
								} finally {
									isClosed = true;
								}
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
											detectedLanguage: primaryLang,
											isUserSpeakingNative: true,
										});
										closeStream();
										return;
									}

									enqueue("transcript.delta", { text: userTranscript });

									const detectedLanguage =
										await detectLanguageFromTranscript(userTranscript);
									console.log("[audio stream] transcript resolved", {
										userTranscript,
										detectedLanguage,
										primaryLang,
										secondaryLanguage,
									});

									enqueue("transcript.final", {
										text: userTranscript,
										detectedLanguage,
									});

									const targetLang =
										detectedLanguage === primaryLang
											? secondaryLanguage
											: primaryLang;

									const sourceLang =
										detectedLanguage === primaryLang
											? primaryLang
											: secondaryLanguage;

									const translatedText = await translateText(
										userTranscript,
										sourceLang,
										targetLang,
									);

									console.log("[audio stream] translation complete", {
										sourceLang,
										targetLang,
										userTranscript,
										translatedText,
									});

									enqueue("translation.final", {
										text: translatedText,
									});
									enqueue("done", {
										userTranscript,
										translatedText,
										sourceLang,
										targetLang,
									});

									void storage
										.createTranslation({
											sourceText: userTranscript,
											translatedText,
											primaryLang,
											secondaryLang:secondaryLanguage
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
									closeStream();
								} catch (error) {
									if (isClosed) return;
									console.error("[audio stream] failed", error);
									enqueue("error", {
										message: getErrorMessage(error),
									});
									closeStream();
								}
							})();
						},
						cancel() {
							console.log("[audio stream] client disconnected");
						}
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
