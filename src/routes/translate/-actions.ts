export const LANGUAGES: { name: string; flag: string }[] = [
  { name: "English",    flag: "🇬🇧" },
  { name: "Japanese",   flag: "🇯🇵" },
  { name: "Spanish",    flag: "🇪🇸" },
  { name: "French",     flag: "🇫🇷" },
  { name: "German",     flag: "🇩🇪" },
  { name: "Chinese",    flag: "🇨🇳" },
  { name: "Korean",     flag: "🇰🇷" },
  { name: "Italian",    flag: "🇮🇹" },
  { name: "Portuguese", flag: "🇧🇷" },
  { name: "Arabic",     flag: "🇸🇦" },
  { name: "Hindi",      flag: "🇮🇳" },
  { name: "Russian",    flag: "🇷🇺" },
  { name: "Dutch",      flag: "🇳🇱" },
  { name: "Turkish",    flag: "🇹🇷" },
  { name: "Polish",     flag: "🇵🇱" },
  { name: "Swedish",    flag: "🇸🇪" },
];

export function getLangFlag(name: string) {
  return LANGUAGES.find(l => l.name === name)?.flag ?? "🌐";
}
