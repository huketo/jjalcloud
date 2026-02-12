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
	width?: number;
	height?: number;
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
	width?: number;
	height?: number;
	createdAt: string;
	likeCount?: number;
	isLiked?: boolean;
}

export interface GifAuthorProfile {
	did?: string;
	handle?: string;
	displayName?: string;
	avatar?: string;
}

export interface GifViewWithAuthor extends GifView {
	authorDid?: string;
	authorHandle?: string;
	authorAvatar?: string;
	authorDisplayName?: string;
}

export interface DbGifRecord {
	uri: string;
	cid: string;
	author: string;
	title: string | null;
	alt: string | null;
	tags: unknown;
	file: unknown;
	width: number | null;
	height: number | null;
	createdAt: Date | string;
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
		width: value.width,
		height: value.height,
		createdAt: value.createdAt,
		likeCount: 0, // Default, needs enrichment
		isLiked: false, // Default, needs enrichment
	};
}

function getRkeyFromUri(uri: string): string {
	return uri.split("/").pop() || "";
}

function toIsoString(createdAt: Date | string): string {
	if (createdAt instanceof Date) {
		return createdAt.toISOString();
	}

	return createdAt;
}

export function parseGifTags(tags: unknown): string[] {
	if (Array.isArray(tags)) {
		return tags.filter((tag): tag is string => typeof tag === "string");
	}

	if (typeof tags !== "string") {
		return [];
	}

	if (!tags.trim()) {
		return [];
	}

	try {
		const parsed = JSON.parse(tags) as unknown;
		if (Array.isArray(parsed)) {
			return parsed.filter((tag): tag is string => typeof tag === "string");
		}
	} catch {}

	return tags
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

export function toGifViewFromDbRecord(record: DbGifRecord): GifView {
	return {
		uri: record.uri,
		cid: record.cid,
		rkey: getRkeyFromUri(record.uri),
		title: record.title ?? undefined,
		alt: record.alt ?? undefined,
		tags: parseGifTags(record.tags),
		file: record.file as BlobRef,
		width: record.width ?? undefined,
		height: record.height ?? undefined,
		createdAt: toIsoString(record.createdAt),
		likeCount: 0,
		isLiked: false,
	};
}

export function toGifViewWithAuthorFromDbRecord(
	record: DbGifRecord,
	profile?: GifAuthorProfile | null,
): GifViewWithAuthor {
	return {
		...toGifViewFromDbRecord(record),
		authorDid: record.author,
		authorHandle: profile?.handle || "unknown",
		authorAvatar: profile?.avatar,
		authorDisplayName: profile?.displayName,
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
