import { createFileRoute } from "@tanstack/react-router";
import OpenAI from "openai";
import { storage } from "#/db/storage";
import { openai } from "#/lib/audio";
import { translateText } from "#/lib/translation/client";

const LANGUAGE_CODE_MAP: Record<string, string> = {
	en: "english",
	es: "spanish",
	fr: "french",
	de: "german",
	it: "italian",
	pt: "portuguese",
	zh: "chinese",
	ja: "japanese",
	ko: "korean",
	ar: "arabic",
	ru: "russian",
	hi: "hindi",
	nl: "dutch",
	pl: "polish",
	tr: "turkish",
	vi: "vietnamese",
	th: "thai",
	id: "indonesian",
	ms: "malay",
	cs: "czech",
	ro: "romanian",
	hu: "hungarian",
	el: "greek",
	sv: "swedish",
	da: "danish",
	fi: "finnish",
	no: "norwegian",
	uk: "ukrainian",
	he: "hebrew",
};

function detectLanguage(languageCode: string): string {
	return LANGUAGE_CODE_MAP[languageCode?.toLowerCase()] || languageCode;
}

function normalizeLanguage(language: string): string {
	const normalized = language.toLowerCase();
	return LANGUAGE_CODE_MAP[normalized] || normalized;
}

export const Route = createFileRoute("/api/translate/audio/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const { audio, nativeLanguage, secondaryLanguage } =
						await request.json();

					if (!audio || !nativeLanguage) {
						return new Response(
							JSON.stringify({
								error: "Missing required fields: audio, nativeLanguage",
							}),
							{ status: 400 },
						);
					}

					const inputFormat = "webm";

					const transcription = await openai.audio.transcriptions.create({
						file: await OpenAI.toFile(
							Buffer.from(audio, "base64"),
							"audio.webm",
						),
						model: "gpt-4o-mini-transcribe",
						language: undefined,
						response_format: "json",
					});

					const userTranscript = transcription.text;
					const detectedLanguageCode = (transcription as any).language;
					const detectedLanguage = detectLanguage(detectedLanguageCode);
					const normalizedNative = normalizeLanguage(nativeLanguage);

					let sourceLanguage: string;
					let targetLanguage: string;
					let detectedInputLanguage: string;

					if (secondaryLanguage) {
						const normalizedSecondary = normalizeLanguage(secondaryLanguage);
						detectedInputLanguage =
							detectedLanguage === normalizedNative
								? normalizedNative
								: normalizedSecondary || detectedLanguage;

						if (detectedInputLanguage === normalizedNative) {
							sourceLanguage = normalizedNative;
							targetLanguage = normalizedSecondary;
						} else {
							sourceLanguage = detectedInputLanguage;
							targetLanguage = normalizedNative;
						}
					} else {
						detectedInputLanguage =
							detectedLanguage === normalizedNative
								? normalizedNative
								: detectedLanguage;

						if (detectedInputLanguage === normalizedNative) {
							sourceLanguage = normalizedNative;
							targetLanguage = detectedLanguage;
						} else {
							sourceLanguage = detectedInputLanguage;
							targetLanguage = normalizedNative;
						}
					}

					if (!targetLanguage) {
						return new Response(
							JSON.stringify({ error: "Could not determine target language" }),
							{ status: 400 },
						);
					}

					const translatedText = await translateText(
						userTranscript,
						sourceLanguage,
						targetLanguage,
					);

					const stream = await openai.chat.completions.create({
						model: "gpt-audio",
						modalities: ["text", "audio"],
						audio: { voice: "alloy", format: "pcm16" },
						messages: [
							{
								role: "system",
								content:
									"You are a text-to-speech engine. Simply speak the provided text verbatim with natural intonation.",
							},
							{
								role: "user",
								content: translatedText,
							},
						],
						stream: true,
					});

					let assistantTranscript = "";
					let fullAudioData = "";

					for await (const chunk of stream) {
						const delta = chunk.choices?.[0]?.delta as any;
						if (!delta) continue;

						if (delta?.audio?.transcript) {
							assistantTranscript += delta.audio.transcript;
						}

						if (delta?.audio?.data) {
							fullAudioData += delta.audio.data;
						}
					}

					await storage.createTranslation({
						sourceLanguage,
						targetLanguage,
						sourceText: userTranscript,
						translatedText: assistantTranscript,
					});

					return new Response(
						JSON.stringify({
							type: "done",
							detectedLanguage: detectedInputLanguage,
							isUserSpeakingNative: detectedInputLanguage === normalizedNative,
							userTranscript,
							translatedText: assistantTranscript,
							audio: fullAudioData,
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
