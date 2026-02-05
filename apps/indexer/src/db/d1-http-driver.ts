import type { Logger } from "pino";

export interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
	meta?: {
		changes?: number;
		duration?: number;
		last_row_id?: number;
		rows_read?: number;
		rows_written?: number;
	};
}

export interface D1Response<T = unknown> {
	result: D1Result<T>[];
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	messages: string[];
}

export interface D1DriverConfig {
	accountId: string;
	databaseId: string;
	apiToken: string;
	logger?: Logger;
}

/**
 * Cloudflare D1 HTTP API Driver for drizzle-orm/sqlite-proxy
 * @see https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database
 */
export function createD1HttpDriver(config: D1DriverConfig) {
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}`;
	const headers = {
		Authorization: `Bearer ${config.apiToken}`,
		"Content-Type": "application/json",
	};

	async function executeQuery<T = unknown>(
		sql: string,
		params: unknown[],
	): Promise<D1Result<T>> {
		const response = await fetch(`${baseUrl}/query`, {
			method: "POST",
			headers,
			body: JSON.stringify({ sql, params }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			config.logger?.error(
				{ status: response.status, error: errorText },
				"D1 API Error",
			);
			console.error("D1 API Error Raw:", errorText);
			throw new Error(`D1 API Error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as D1Response<T>;

		if (!data.success) {
			config.logger?.error({ errors: data.errors }, "D1 Query Failed");
			console.error("D1 Query Failed Raw:", JSON.stringify(data.errors));
			throw new Error(`D1 Query Failed: ${JSON.stringify(data.errors)}`);
		}

		const result = data.result[0];

		return result;
	}

	/**
	 * SQLite Proxy driver function for drizzle-orm
	 * @see https://orm.drizzle.team/docs/get-started-sqlite#http-proxy
	 */
	return async (
		sql: string,
		params: unknown[],
		method: "run" | "all" | "values" | "get",
	): Promise<{ rows: unknown[] | unknown[][] }> => {
		config.logger?.debug({ sql, params, method }, "Executing D1 query");

		const result = await executeQuery(sql, params);

		switch (method) {
			case "all":
				// Important: sqlite-proxy expects rows to be arrays of values, not objects
				// We assume Object.values() returns values in the same order as the SELECT query
				// This is generally true for non-integer keys in JS engines
				return {
					rows: result.results.map((row) =>
						Object.values(row as Record<string, unknown>),
					),
				};
			case "get":
				return {
					rows: result.results[0]
						? [Object.values(result.results[0] as Record<string, unknown>)]
						: [],
				};
			case "values":
				return {
					rows: result.results.map((row) =>
						Object.values(row as Record<string, unknown>),
					),
				};
			case "run":
				return { rows: [] };
			default:
				return { rows: [] };
		}
	};
}
