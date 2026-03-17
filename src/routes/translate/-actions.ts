export const LANGUAGES: { name: string; flag: string }[] = [
	{ name: "English", flag: "US" },
	{ name: "Japanese", flag: "JP" },
	{ name: "Spanish", flag: "ES" },
	{ name: "French", flag: "FR" },
	{ name: "German", flag: "DE" },
	{ name: "Chinese", flag: "CN" },
	{ name: "Korean", flag: "KR" },
	{ name: "Italian", flag: "IT" },
	{ name: "Portuguese", flag: "BR" },
	{ name: "Arabic", flag: "SA" },
	{ name: "Hindi", flag: "IN" },
	{ name: "Russian", flag: "RU" },
	{ name: "Dutch", flag: "NL" },
	{ name: "Turkish", flag: "TR" },
	{ name: "Polish", flag: "PL" },
	{ name: "Swedish", flag: "SE" },
	{ name: "Indonesian", flag: "ID" },
	{ name: "Vietnamese", flag: "VN" },
	{ name: "Thai", flag: "TH" },
	{ name: "Bengali", flag: "BD" },
	{ name: "Urdu", flag: "PK" },
	{ name: "Malay", flag: "MY" },
	{ name: "Tagalog", flag: "PH" },
	{ name: "Greek", flag: "GR" },
];

export function getLangFlag(name: string) {
	return LANGUAGES.find((l) => l.name === name)?.flag ?? "US";
}

export function getLangFlagUrl(name: string) {
	const code = getLangFlag(name);
	return `https://flagsapi.com/${code}/flat/64.png`;
}
