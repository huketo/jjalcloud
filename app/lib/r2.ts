import { S3Client } from "bun";

let _client: S3Client | null = null;

export function getClient(): S3Client {
	if (!_client) {
		const { env } = require("../env");
		_client = new S3Client({
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			bucket: env.R2_BUCKET,
			endpoint: env.R2_ENDPOINT,
			region: env.R2_REGION ?? "auto",
		});
	}
	return _client;
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
	const { env } = require("../env");
	await getClient().write(key, body, { type: contentType });
	return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function existsInR2(key: string): Promise<boolean> {
	return getClient().exists(key);
}

export function r2Key(author: string, rkey: string, variant: string): string {
	return `gifs/${author}/${rkey}/${variant}`;
}

export function cfResizeUrl(originalUrl: string, width: number): string {
	const url = new URL(originalUrl);
	return `${url.origin}/cdn-cgi/image/width=${width},fit=contain${url.pathname}`;
}
