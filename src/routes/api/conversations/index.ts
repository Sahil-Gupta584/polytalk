import { createFileRoute } from "@tanstack/react-router";
import { chatStorage } from "#/lib/chat";

export const Route = createFileRoute("/api/conversations/")({
	server: {
		handlers: {
			GET: async () => {
				try {
					const conversations = await chatStorage.getAllConversations();
					return new Response(JSON.stringify(conversations));
				} catch (error) {
					console.error("Error fetching conversations:", error);
					return new Response(
						JSON.stringify({ error: "Failed to fetch conversations" }),
						{ status: 500 },
					);
				}
			},
			POST: async ({ request }) => {
				try {
					const { title } = await request.json();
					const conversation = await chatStorage.createConversation(
						title || "New Chat",
					);
					return new Response(JSON.stringify(conversation), { status: 201 });
				} catch (error) {
					console.error("Error creating conversation:", error);
					return new Response(
						JSON.stringify({ error: "Failed to create conversation" }),
						{ status: 500 },
					);
				}
			},
		},
	},
});
