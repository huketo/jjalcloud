import { S3Client } from "bun";

const S3_ENDPOINT = process.env.R2_ENDPOINT ?? "http://localhost:3900";
const S3_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const S3_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const S3_BUCKET = process.env.R2_BUCKET ?? "jjalcloud-gifs";
const S3_REGION = process.env.R2_REGION ?? "garage";

export const testS3 = new S3Client({
	accessKeyId: S3_ACCESS_KEY,
	secretAccessKey: S3_SECRET_KEY,
	bucket: S3_BUCKET,
	endpoint: S3_ENDPOINT,
	region: S3_REGION,
});

export async function objectExists(key: string): Promise<boolean> {
	return testS3.exists(key);
}
