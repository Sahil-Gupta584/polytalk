import { createFileRoute } from "@tanstack/react-router";
import { chatStorage } from "#/lib/chat";

export const Route = createFileRoute("/api/conversations/$id/")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const id = parseInt(params.id);
					const conversation = await chatStorage.getConversation(id);
					if (!conversation) {
						return new Response(
							JSON.stringify({ error: "Conversation not found" }),
						);
					}
					const messages = await chatStorage.getMessagesByConversation(id);
					return new Response(JSON.stringify({ ...conversation, messages }));
				} catch (error) {
					console.error("Error fetching conversation:", error);
					return new Response(
						JSON.stringify({ error: "Failed to fetch conversation" }),
					);
				}
			},
			DELETE: async ({ params }) => {
				try {
					const id = parseInt(params.id);
					await chatStorage.deleteConversation(id);
					return new Response(null, { status: 204 });
				} catch (error) {
					console.error("Error deleting conversation:", error);
					return new Response(
						JSON.stringify({ error: "Failed to delete conversation" }),
						{ status: 500 },
					);
				}
			},
		},
	},
});
