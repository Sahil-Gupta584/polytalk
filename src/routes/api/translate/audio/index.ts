import { createFileRoute } from "@tanstack/react-router";
import LanguageDetect from "languagedetect";
import OpenAI from "openai";
import { storage } from "#/db/storage";
import { codeToName, translateText } from "#/lib/translation/client";

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

export const Route = createFileRoute("/api/translate/audio/")({
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
					const buffer = Buffer.from(arrayBuffer);
					const fileName = audioFile.name || "audio.mp3";

					console.log("[audio translate] processing file", {
						fileName,
						size: buffer.length,
						type: audioFile.type,
					});

					// const transcription = await openai.audio.transcriptions.create({
					// 	file: await OpenAI.toFile(buffer, fileName),
					// 	model: "gpt-4o-mini-transcribe",
					// 	response_format: "json",
					// });

					const userTranscript = 'transcription.text';

					const detectedLanguage = detectLanguageFromTranscript(
						userTranscript,
						[nativeLanguage, secondaryLanguage],
					);

					const sourceLanguage = detectedLanguage;
					const targetLanguage =
						detectedLanguage === nativeLanguage
							? secondaryLanguage
							: nativeLanguage;

					console.log("[audio translate] resolved languages", {
						userTranscript,
						detectedLanguage,
						nativeLanguage: nativeLanguage,
						secondaryLanguage: secondaryLanguage,
						sourceLanguage,
						targetLanguage,
					});

					if (!sourceLanguage) {
						console.error("[audio translate] missing source language", {
							userTranscript,
							nativeLanguage,
							secondaryLanguage,
						});
						return new Response(
							JSON.stringify({
								error:
									"Could not determine the spoken language from the audio input.",
							}),
							{ status: 422 },
						);
					}

					if (!targetLanguage || targetLanguage === sourceLanguage) {
						console.log("[audio translate] skipping translation", {
							reason: !targetLanguage
								? "no target language"
								: "source equals target",
							sourceLanguage,
							targetLanguage,
						});
						return new Response(
							JSON.stringify({
								type: "done",
								detectedLanguage: detectedLanguage,
								isUserSpeakingNative: true,
								userTranscript,
								translatedText: userTranscript,
								audio: "",
							}),
						);
					}

					const translatedText = await translateText(
						userTranscript,
						sourceLanguage,
						targetLanguage,
					);

					void storage
						.createTranslation({
							sourceLanguage,
							targetLanguage,
							sourceText: userTranscript,
							translatedText,
						})
						.catch((storageError) => {
							console.error(
								"[audio translate] failed to store translation",
								storageError,
							);
						});

					return new Response(
						JSON.stringify({
							type: "done",
							detectedLanguage: detectedLanguage,
							isUserSpeakingNative: detectedLanguage === nativeLanguage,
							userTranscript,
							translatedText,
						}),
					);
				} catch (error) {
					console.error("Error processing voice translation:", error);
					return new Response(JSON.stringify({ error: "Translation failed" }), {
						status: 500,
					});
				}
			},
		},
	},
});
