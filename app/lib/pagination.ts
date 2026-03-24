export function nextCursor<T extends { createdAt: Date }>(
	results: T[],
	limit: number,
): string | undefined {
	if (results.length < limit) return undefined;
	return results[results.length - 1]?.createdAt.toISOString();
}

export function parseLimit(raw: string | undefined, defaultVal: number, max = 100): number {
	const n = Number(raw ?? defaultVal);
	if (!Number.isFinite(n) || n < 1) return defaultVal;
	return Math.min(n, max);
}
