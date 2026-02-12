import type { BrowserContext } from "@playwright/test";

const DEFAULT_APP_URL = "http://127.0.0.1:5173";
const SESSION_COOKIE = "jjalcloud_session";

interface SeedSessionOptions {
	did?: string;
	appUrl?: string;
}

export async function seedSessionCookie(
	context: BrowserContext,
	options: SeedSessionOptions = {},
) {
	const did = options.did ?? "did:plc:playwright-user";
	const appUrl = options.appUrl ?? DEFAULT_APP_URL;

	await context.addCookies([
		{
			name: SESSION_COOKIE,
			value: did,
			url: appUrl,
			httpOnly: true,
			sameSite: "Lax",
		},
	]);
}
