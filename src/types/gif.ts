import type { BlobRef } from "@atproto/lexicon";

/**
 * GIF 레코드 타입 (com.jjalcloud.feed.gif)
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
 * GIF 목록 응답에서 사용하는 뷰 타입
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
}

/**
 * GIF 업데이트 요청 타입
 */
export interface GifUpdateRequest {
	title?: string;
	alt?: string;
	tags?: string[];
}

/**
 * ATProto 레코드를 GifView로 변환합니다.
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
	};
}

/**
 * 태그 문자열을 파싱합니다.
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
