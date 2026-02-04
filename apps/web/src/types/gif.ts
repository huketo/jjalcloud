import type { BlobRef } from "@atproto/lexicon";

/**
 * GIF Record Type (com.jjalcloud.feed.gif)
 */
export interface GifRecord {
	$type: "com.jjalcloud.feed.gif";
	file: BlobRef;
	title?: string;
	alt?: string;
	tags?: string[];
	createdAt: string;
}

/**
 * View type used in GIF list response
 */
export interface GifView {
	uri: string;
	cid: string;
	rkey: string;
	title?: string;
	alt?: string;
	tags: string[];
	file: BlobRef;
	createdAt: string;
	likeCount?: number;
	isLiked?: boolean;
}

/**
 * GIF update request type
 */
export interface GifUpdateRequest {
	title?: string;
	alt?: string;
	tags?: string[];
}

/**
 * Convert ATProto record to GifView.
 */
export function toGifView(record: {
	uri: string;
	cid: string;
	value: unknown;
}): GifView {
	const value = record.value as GifRecord;
	return {
		uri: record.uri,
		cid: record.cid,
		rkey: record.uri.split("/").pop() || "",
		title: value.title,
		alt: value.alt,
		tags: value.tags || [],
		file: value.file,
		createdAt: value.createdAt,
		likeCount: 0, // Default, needs enrichment
		isLiked: false, // Default, needs enrichment
	};
}

/**
 * Parse tags string.
 */
export function parseTags(
	tagsStr: string | null,
	maxCount = 10,
): string[] | undefined {
	if (!tagsStr) return undefined;

	const tags = tagsStr
		.split(",")
		.map((t) => t.trim())
		.filter((t) => t.length > 0)
		.slice(0, maxCount);

	return tags.length > 0 ? tags : undefined;
}
