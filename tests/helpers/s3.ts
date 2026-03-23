import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const S3_ENDPOINT = process.env.R2_ENDPOINT ?? "http://localhost:3900";
const S3_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const S3_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const S3_BUCKET = process.env.R2_BUCKET ?? "jjalcloud-gifs";

export const testS3 = new S3Client({
	region: "garage",
	endpoint: S3_ENDPOINT,
	credentials: {
		accessKeyId: S3_ACCESS_KEY,
		secretAccessKey: S3_SECRET_KEY,
	},
	forcePathStyle: true,
});

/** Check if an object exists in the test bucket */
export async function objectExists(key: string): Promise<boolean> {
	try {
		await testS3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
		return true;
	} catch {
		return false;
	}
}

/** List all objects in the test bucket */
export async function listObjects(): Promise<string[]> {
	const result = await testS3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET }));
	return result.Contents?.map((o) => o.Key!).filter(Boolean) ?? [];
}
