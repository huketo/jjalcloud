import { cfResizeUrl, r2Key } from "./r2";

interface GifRow {
	uri: string;
	rkey: string;
	author: string;
	title: string | null;
	alt: string | null;
	width: number | null;
	height: number | null;
	createdAt: Date;
	tags?: { name: string }[];
}

interface TenorMediaFormat {
	url: string;
	dims: [number, number];
	size?: number;
}

interface TenorGifObject {
	id: string;
	title: string;
	content_description: string;
	tags: string[];
	media_formats: {
		gif: TenorMediaFormat;
		mediumgif: TenorMediaFormat;
		tinygif: TenorMediaFormat;
		mp4: TenorMediaFormat;
		tinymp4: TenorMediaFormat;
		webm: TenorMediaFormat;
	};
	created: number;
	url: string;
}

export function toTenorGifObject(gif: GifRow): TenorGifObject {
	const { env } = require("../env");
	const w = gif.width ?? 480;
	const h = gif.height ?? 270;
	const originalUrl = `${env.R2_PUBLIC_URL}/${r2Key(gif.author, gif.rkey, "original.gif")}`;

	const aspectRatio = h / w;
	const mediumW = 320;
	const mediumH = Math.round(mediumW * aspectRatio);
	const tinyW = 220;
	const tinyH = Math.round(tinyW * aspectRatio);

	return {
		id: gif.rkey,
		title: gif.title ?? "",
		content_description: gif.alt ?? "",
		tags: gif.tags?.map((t) => t.name) ?? [],
		media_formats: {
			gif: { url: originalUrl, dims: [w, h] },
			mediumgif: { url: cfResizeUrl(originalUrl, mediumW), dims: [mediumW, mediumH] },
			tinygif: { url: cfResizeUrl(originalUrl, tinyW), dims: [tinyW, tinyH] },
			mp4: { url: `${env.R2_PUBLIC_URL}/${r2Key(gif.author, gif.rkey, "mp4")}`, dims: [w, h] },
			tinymp4: {
				url: `${env.R2_PUBLIC_URL}/${r2Key(gif.author, gif.rkey, "tinymp4")}`,
				dims: [mediumW, mediumH],
			},
			webm: {
				url: `${env.R2_PUBLIC_URL}/${r2Key(gif.author, gif.rkey, "webm")}`,
				dims: [w, h],
			},
		},
		created: Math.floor(gif.createdAt.getTime() / 1000),
		url: `${env.PUBLIC_URL}/gif/${gif.author}/${gif.rkey}`,
	};
}

export function tenorResponse(results: TenorGifObject[], next: string | null) {
	return {
		results,
		...(next ? { next } : {}),
	};
}
