import { existsInR2, r2Key, uploadToR2 } from "../lib/r2";

function getEnv() {
	const { env } = require("../env");
	return env;
}

export async function cacheOriginalGif(
	pdsUrl: string,
	author: string,
	rkey: string,
): Promise<string> {
	const key = r2Key(author, rkey, "original.gif");
	const exists = await existsInR2(key);
	if (exists) return `${getEnv().R2_PUBLIC_URL}/${key}`;

	const response = await fetch(pdsUrl);
	if (!response.ok) throw new Error(`Failed to fetch blob: ${response.status}`);

	const buffer = Buffer.from(await response.arrayBuffer());
	return uploadToR2(key, buffer, "image/gif");
}

export async function convertToVideo(
	author: string,
	rkey: string,
	variant: "mp4" | "tinymp4" | "webm",
): Promise<string> {
	const key = r2Key(author, rkey, variant);
	const exists = await existsInR2(key);
	if (exists) return `${getEnv().R2_PUBLIC_URL}/${key}`;

	const originalKey = r2Key(author, rkey, "original.gif");
	const originalUrl = `${getEnv().R2_PUBLIC_URL}/${originalKey}`;

	const response = await fetch(originalUrl);
	if (!response.ok) throw new Error("Original GIF not found in R2");

	const inputBuffer = Buffer.from(await response.arrayBuffer());
	const uid = crypto.randomUUID();
	const tmpInput = `/tmp/${uid}-input.gif`;

	await Bun.write(tmpInput, inputBuffer);

	const scale = variant === "tinymp4" ? "scale=320:-2" : "scale=-2:-2";
	const codec = variant === "webm" ? "libvpx-vp9" : "libx264";
	const ext = variant === "webm" ? "webm" : "mp4";
	const tmpOutput = `/tmp/${uid}-output.${ext}`;

	const proc = Bun.spawn([
		"ffmpeg",
		"-y",
		"-i",
		tmpInput,
		"-vf",
		scale,
		"-c:v",
		codec,
		"-an",
		"-movflags",
		"+faststart",
		tmpOutput,
	]);
	await proc.exited;

	const outputBuffer = await Bun.file(tmpOutput).arrayBuffer();
	const contentType = variant === "webm" ? "video/webm" : "video/mp4";
	const url = await uploadToR2(key, Buffer.from(outputBuffer), contentType);

	await Bun.spawn(["rm", "-f", tmpInput, tmpOutput]).exited;

	return url;
}
