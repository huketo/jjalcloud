// This file is loaded as a Bun test preload (via bunfig.toml [test] preload).
// It runs before any test file module graph is evaluated, so process.env
// assignments here are visible when src/env.ts runs envSchema.parse(process.env).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envTestPath = resolve(process.cwd(), ".env.test");

if (existsSync(envTestPath)) {
	// Integration test mode: load real .env.test values
	const content = readFileSync(envTestPath, "utf-8");
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx);
		const value = trimmed.slice(eqIdx + 1);
		// Don't override if already set in environment
		if (!process.env[key]) {
			process.env[key] = value;
		}
	}
} else {
	// Unit test mode: use mock values (no real infra needed)
	const mockEnv: Record<string, string> = {
		DATABASE_URL: "postgres://test",
		R2_ENDPOINT: "https://r2.example.com",
		R2_ACCESS_KEY_ID: "test",
		R2_SECRET_ACCESS_KEY: "test",
		R2_BUCKET: "test",
		R2_PUBLIC_URL: "https://cdn.jjalcloud.com",
		OAUTH_CLIENT_ID: "test",
		OAUTH_REDIRECT_URI: "https://jjalcloud.com/oauth/callback",
		OAUTH_PRIVATE_KEY: "{}",
		PUBLIC_URL: "https://jjalcloud.com",
	};
	for (const [key, value] of Object.entries(mockEnv)) {
		if (!process.env[key]) {
			process.env[key] = value;
		}
	}
}
