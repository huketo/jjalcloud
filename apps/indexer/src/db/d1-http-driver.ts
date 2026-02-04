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
			throw new Error(`D1 API Error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as D1Response<T>;

		if (!data.success) {
			config.logger?.error({ errors: data.errors }, "D1 Query Failed");
			throw new Error(`D1 Query Failed: ${JSON.stringify(data.errors)}`);
		}

		return data.result[0];
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
				return { rows: result.results };
			case "get":
				return { rows: result.results[0] ? [result.results[0]] : [] };
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
