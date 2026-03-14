import { createFileRoute } from "@tanstack/react-router";
import { env } from "#/lib/env";

export const Route = createFileRoute("/api/translate/audio/tts")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					// if (!env.GOOGLE_TTS_API_KEY) {
					// 	return new Response(
					// 		JSON.stringify({
					// 			error: "GOOGLE_TTS_API_KEY is not configured",
					// 		}),
					// 		{ status: 503 },
					// 	);
					// }

					const { text, languageCode } = (await request.json()) as {
						text?: string;
						languageCode?: string;
					};

					if (!text?.trim() || !languageCode?.trim()) {
						return new Response(
							JSON.stringify({
								error: "Missing required fields: text, languageCode",
							}),
							{ status: 400 },
						);
					}

					const response = await fetch(
						`https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								input: {
									text,
								},
								voice: {
									languageCode,
									...(env.GOOGLE_TTS_VOICE_NAME
										? { name: env.GOOGLE_TTS_VOICE_NAME }
										: {}),
								},
								audioConfig: {
									audioEncoding: "MP3",
									speakingRate: 0.95,
								},
							}),
						},
					);

					if (!response.ok) {
						const errorText = await response.text();
						console.error("[google tts] request failed", {
							status: response.status,
							body: errorText,
							languageCode,
						});
						return new Response(
							JSON.stringify({ error: "Google TTS request failed" }),
							{ status: 502 },
						);
					}

					const data = (await response.json()) as {
						audioContent?: string;
					};

					if (!data.audioContent) {
						return new Response(
							JSON.stringify({ error: "Google TTS returned no audio" }),
							{ status: 502 },
						);
					}

					return new Response(
						JSON.stringify({
							audio: data.audioContent,
							format: "mp3",
							provider: "google",
						}),
					);
				} catch (error) {
					console.error("[google tts] failed", error);
					return new Response(
						JSON.stringify({ error: "Speech generation failed" }),
						{ status: 500 },
					);
				}
			},
		},
	},
});
