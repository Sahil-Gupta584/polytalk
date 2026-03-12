import { env } from "../env";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function codeToName(code: string): string {
	return languageNames.of(code)?.toLowerCase() || code.toLowerCase();
}

export async function translateText(
	text: string,
	sourceLocale: string,
	targetLocale: string,
): Promise<string> {
	if (!sourceLocale || !targetLocale) {
		throw new Error("Missing source or target language for translation");
	}

	console.log("[translation client] request payload", {
		text,
		sourceLocale,
		targetLocale,
	});

	const response = await fetch("https://api.lingo.dev/process/localize", {
		method: "POST",
		headers: {
			"X-API-Key": env.LINGODOTDEV_API_KEY,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			engineId: "eng_JtC1dHnG9n4zxcuf",
			sourceLocale,
			targetLocale,
			data: {text},
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[translation client] lingo request failed", {
			status: response.status,
			statusText: response.statusText,
			body: errorText,
		});
		throw new Error(`Translation API failed with status ${response.status}`);
	}

	const { data } = await response.json();
	console.log("[translation client] response", { data });

	return data?.text;
}

export { codeToName };
