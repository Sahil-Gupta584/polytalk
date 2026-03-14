import z from "zod";

const envSchema = z.object({
	LINGODOTDEV_API_KEY: z.string(),
	GOOGLE_TTS_API_KEY: z.string().optional(),
	GOOGLE_TTS_VOICE_NAME: z.string().optional(),
	GOOGLE_STT_API_KEY: z.string().optional(),
	GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
	console.error("❌ Invalid environment variables:", _env.error.format());
	throw new Error("Invalid environment variables");
}

export const env = _env.data;
