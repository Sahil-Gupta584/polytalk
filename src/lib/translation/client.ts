
const apiKey = process.env.LINGO_API_KEY || "";


export async function translateText(
	text: string,
	sourceLanguage: string,
	targetLanguage: string,
): Promise<string> {
	const localeMap: Record<string, string> = {
		english: "en",
		spanish: "es",
		french: "fr",
		german: "de",
		italian: "it",
		portuguese: "pt",
		chinese: "zh",
		japanese: "ja",
		korean: "ko",
		arabic: "ar",
		russian: "ru",
		hindi: "hi",
		dutch: "nl",
		polish: "pl",
		turkish: "tr",
		vietnamese: "vi",
		thai: "th",
		indonesian: "id",
		malay: "ms",
		czech: "cs",
		romanian: "ro",
		hungarian: "hu",
		greek: "el",
		swedish: "sv",
		danish: "da",
		finnish: "fi",
		norwegian: "no",
		ukrainian: "uk",
		hebrew: "he",
	};

	const sourceLocale =
		localeMap[sourceLanguage.toLowerCase()] || sourceLanguage.toLowerCase();
	const targetLocale =
		localeMap[targetLanguage.toLowerCase()] || targetLanguage.toLowerCase();

	const response = await fetch("https://api.lingo.dev/process/localize", {
		method: "POST",
		headers: {
			"X-API-Key": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			engineId: "eng_JtC1dHnG9n4zxcuf",
			sourceLocale,
			targetLocale,
			data: text,
		}),
	});

	const { data } = await response.json();
  console.log({data});
  
	return data;
}
