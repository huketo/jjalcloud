/**
 * Global Application Constants
 */

// Session Constants
export const SESSION_COOKIE = "jjalcloud_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

// Collection NSIDs
export const GIF_COLLECTION = "com.jjalcloud.feed.gif";
export const LIKE_COLLECTION = "com.jjalcloud.feed.like";
export const FOLLOW_COLLECTION = "com.jjalcloud.graph.follow";

// File Limits
export const MAX_GIF_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_TAGS_COUNT = 10;

// ATProto Related
export const BSKY_PUBLIC_API = "https://public.api.bsky.app";
export const BSKY_SOCIAL = "https://bsky.social";
