import z from "zod";

const envSchema = z.object({
	LINGODOTDEV_API_KEY: z.string(),
	GOOGLE_TTS_API_KEY: z.string(),
	GOOGLE_TTS_VOICE_NAME: z.string().optional(),
	GOOGLE_STT_API_KEY: z.string(),
	GOOGLE_CLOUD_PROJECT_ID: z.string(),
	GOOGLE_SERVICE_ACCOUNT_FILE: z.string(),
	GOOGLE_STT_REGION: z.string(),
	GOOGLE_STT_MODEL: z.string(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
	console.error("❌ Invalid environment variables:", _env.error.issues);
	// throw new Error("Invalid environment variables");
}

export const env = _env.data;
