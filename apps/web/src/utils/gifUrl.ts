export interface GifUrlSource {
	uri: string;
	cid?: unknown;
	file?: unknown;
}

function getDidFromUri(uri: string): string {
	const parts = uri.split("/");
	return parts[2] || "";
}

function resolveCid(value: unknown): string | undefined {
	if (!value) {
		return undefined;
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "function") {
		try {
			return resolveCid(value());
		} catch {
			return undefined;
		}
	}

	if (typeof value === "object") {
		if ("$link" in value) {
			return resolveCid((value as { $link?: unknown }).$link);
		}

		if ("link" in value) {
			return resolveCid((value as { link?: unknown }).link);
		}

		const stringified = value.toString();
		if (stringified && stringified !== "[object Object]") {
			return stringified;
		}
	}

	return undefined;
}

function getCid(file: unknown, fallbackCid: unknown): string {
	if (file && typeof file === "object" && "ref" in file) {
		const cidFromRef = resolveCid((file as { ref?: unknown }).ref);
		if (cidFromRef) {
			return cidFromRef;
		}
	}

	return resolveCid(fallbackCid) || "";
}

export function getGifUrl(gif: GifUrlSource): string {
	const did = getDidFromUri(gif.uri);
	const cid = getCid(gif.file, gif.cid);

	return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`;
}
