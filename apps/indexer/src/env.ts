import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	FIREHOSE_URL: z.string().default("wss://bsky.network"),
	PLC_URL: z.string().default("https://plc.directory"),
	LOG_LEVEL: z.string().default("info"),
	LOCAL_DB_PATH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
