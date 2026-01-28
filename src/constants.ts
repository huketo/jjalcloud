/**
 * 애플리케이션 전역 상수
 */

// 세션 관련 상수
export const SESSION_COOKIE = "jjalcloud_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일 (초 단위)

// 컬렉션 NSID
export const GIF_COLLECTION = "com.jjalcloud.feed.gif";
export const LIKE_COLLECTION = "com.jjalcloud.feed.like";
export const FOLLOW_COLLECTION = "com.jjalcloud.graph.follow";

// 파일 제한
export const MAX_GIF_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_TAGS_COUNT = 10;

// ATProto 관련
export const BSKY_PUBLIC_API = "https://public.api.bsky.app";
export const BSKY_SOCIAL = "https://bsky.social";
