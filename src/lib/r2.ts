import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getR2Client(): S3Client {
	const { env } = require("../env");
	return new S3Client({
		region: env.R2_REGION ?? "auto",
		endpoint: env.R2_ENDPOINT,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		},
		forcePathStyle: true,
	});
}

let _r2: S3Client | null = null;

export function getClient(): S3Client {
	if (!_r2) {
		_r2 = getR2Client();
	}
	return _r2;
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
	const { env } = require("../env");
	await getClient().send(
		new PutObjectCommand({
			Bucket: env.R2_BUCKET,
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);
	return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function existsInR2(key: string): Promise<boolean> {
	const { env } = require("../env");
	try {
		await getClient().send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
		return true;
	} catch {
		return false;
	}
}

export function r2Key(author: string, rkey: string, variant: string): string {
	return `gifs/${author}/${rkey}/${variant}`;
}

export function cfResizeUrl(originalUrl: string, width: number): string {
	const url = new URL(originalUrl);
	return `${url.origin}/cdn-cgi/image/width=${width},fit=contain${url.pathname}`;
}
