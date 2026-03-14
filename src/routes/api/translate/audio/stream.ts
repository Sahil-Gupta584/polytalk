import { createFileRoute } from "@tanstack/react-router";
import LanguageDetect from "languagedetect";
import OpenAI from "openai";
import { storage } from "#/db/storage";
import { detectAudioFormat, openai } from "#/lib/audio";
import { env } from "#/lib/env";
import { codeToName } from "#/lib/translation/client";

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

function langToLocale(lang: string) {
	try {
		return new Intl.Locale(lang).maximize().toString();
	} catch {
		return lang;
	}
}

async function transcribeWithGoogle(
	audioBuffer: Buffer,
	languageCodes: string[],
) {
	if (!env.GOOGLE_STT_API_KEY || !env.GOOGLE_CLOUD_PROJECT_ID) {
		throw new Error(
			"Google STT is not configured. Set GOOGLE_STT_API_KEY and GOOGLE_CLOUD_PROJECT_ID.",
		);
	}

	const response = await fetch(
		`https://speech.googleapis.com/v2/projects/${env.GOOGLE_CLOUD_PROJECT_ID}/locations/global/recognizers/_:recognize?key=${env.GOOGLE_STT_API_KEY}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				config: {
					autoDecodingConfig: {},
					languageCodes,
					model: "short",
				},
				content: audioBuffer.toString("base64"),
			}),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[google stt] request failed", {
			status: response.status,
			body: errorText,
			languageCodes,
		});
		throw new Error(`Google STT failed with status ${response.status}`);
	}

	const data = (await response.json()) as {
		results?: Array<{
			alternatives?: Array<{
				transcript?: string;
			}>;
		}>;
	};

	const transcript = data.results
		?.flatMap((result) => result.alternatives || [])
		.map((alternative) => alternative.transcript || "")
		.join(" ")
		.trim();

	if (!transcript) {
		throw new Error("Google STT returned no transcript");
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
									"Missing required fields: audio, nativeLanguage, secondaryLanguage",
							}),
							{ status: 400 },
						);
					}

					const arrayBuffer = await audioFile.arrayBuffer();
					const audioBuffer = Buffer.from(arrayBuffer);
					const detectedFormat = detectAudioFormat(audioBuffer);
					const languageCodes = [
						langToLocale(nativeLanguage),
						langToLocale(secondaryLanguage),
					];

					if (detectedFormat === "unknown") {
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

									// const transcription =
										await openai.audio.transcriptions.create({
											file: await OpenAI.toFile(audioBuffer, fileName),
											model: "whisper-1",
											response_format: "json",
										});
									// const userTranscript = transcription.text;

									enqueue("transcript.delta", { text: userTranscript });

									const detectedLanguage = detectLanguageFromTranscript(
										userTranscript,
										[nativeLanguage, secondaryLanguage],
									);
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

									const translationStream =
										await openai.chat.completions.create({
											model: "gpt-4o-mini",
											messages: [
												{
													role: "system",
													content: `Translate the user's text from ${codeToName(sourceLanguage)} to ${codeToName(targetLanguage)}. Return only the translated text.`,
												},
												{
													role: "user",
													content: userTranscript,
												},
											],
											stream: true,
										});

									let translatedText = "";

									for await (const chunk of translationStream) {
										const delta = chunk.choices?.[0]?.delta?.content;
										if (!delta) continue;
										translatedText += delta;
										enqueue("translation.delta", {
											text: translatedText,
										});
									}

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
