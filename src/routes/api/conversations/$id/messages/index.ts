import { createFileRoute } from "@tanstack/react-router";
import { ensureCompatibleFormat, openai, speechToText } from "#/lib/audio";
import { chatStorage } from "#/lib/chat";

export const Route = createFileRoute("/api/conversations/$id/messages/")({
	server: {
		handlers: {
			POST: async ({ params, request }) => {
				try {
					const conversationId = parseInt(params.id);
					const { audio, voice = "alloy" } = await request.json();

					if (!audio) {
						return new Response(
							JSON.stringify({ error: "Audio data (base64) is required" }),
							{ status: 400 },
						);
					}

					const rawBuffer = Buffer.from(audio, "base64");
					const { buffer: audioBuffer, format: inputFormat } =
						await ensureCompatibleFormat(rawBuffer);

					const userTranscript = await speechToText(audioBuffer, inputFormat);

					await chatStorage.createMessage(
						conversationId,
						"user",
						userTranscript,
					);

					const existingMessages =
						await chatStorage.getMessagesByConversation(conversationId);
					const chatHistory = existingMessages.map((m) => ({
						role: m.role as "user" | "assistant",
						content: m.content,
					}));

					const stream = await openai.chat.completions.create({
						model: "gpt-audio",
						modalities: ["text", "audio"],
						audio: { voice, format: "pcm16" },
						messages: chatHistory,
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

					await chatStorage.createMessage(
						conversationId,
						"assistant",
						assistantTranscript,
					);

					return new Response(
						JSON.stringify({
							type: "done",
							userTranscript,
							transcript: assistantTranscript,
							audio: fullAudioData,
						}),
					);
				} catch (error) {
					console.error("Error processing voice message:", error);
					return new Response(
						JSON.stringify({ error: "Failed to process voice message" }),
						{ status: 500 },
					);
				}
			},
		},
	},
});
