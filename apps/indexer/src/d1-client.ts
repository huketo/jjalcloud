import type { Logger } from "pino";

export interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
	meta?: {
		changes?: number;
		duration?: number;
		last_row_id?: number;
	};
}

export interface D1Response<T = unknown> {
	result: D1Result<T>[];
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	messages: string[];
}

export interface D1ClientConfig {
	accountId: string;
	databaseId: string;
	apiToken: string;
	logger?: Logger;
}

/**
 * Cloudflare D1 HTTP API Client
 * @see https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database
 */
export class D1HttpClient {
	private baseUrl: string;
	private headers: Record<string, string>;
	private logger?: Logger;

	constructor(config: D1ClientConfig) {
		this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}`;
		this.headers = {
			Authorization: `Bearer ${config.apiToken}`,
			"Content-Type": "application/json",
		};
		this.logger = config.logger;
	}

	/**
	 * Execute a SQL query with optional parameters
	 */
	async query<T = unknown>(
		sql: string,
		params: unknown[] = [],
	): Promise<D1Result<T>> {
		const response = await fetch(`${this.baseUrl}/query`, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({ sql, params }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			this.logger?.error(
				{ status: response.status, error: errorText },
				"D1 API Error",
			);
			throw new Error(`D1 API Error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as D1Response<T>;

		if (!data.success) {
			this.logger?.error({ errors: data.errors }, "D1 Query Failed");
			throw new Error(`D1 Query Failed: ${JSON.stringify(data.errors)}`);
		}

		return data.result[0];
	}

	/**
	 * Execute multiple SQL statements in a batch
	 */
	async batch(
		statements: Array<{ sql: string; params?: unknown[] }>,
	): Promise<D1Result[]> {
		const response = await fetch(`${this.baseUrl}/query`, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify(
				statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })),
			),
		});

		if (!response.ok) {
			const errorText = await response.text();
			this.logger?.error(
				{ status: response.status, error: errorText },
				"D1 Batch API Error",
			);
			throw new Error(`D1 Batch API Error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as D1Response;

		if (!data.success) {
			this.logger?.error({ errors: data.errors }, "D1 Batch Query Failed");
			throw new Error(`D1 Batch Query Failed: ${JSON.stringify(data.errors)}`);
		}

		return data.result;
	}

	/**
	 * Insert a record into the likes table
	 */
	async insertLike(data: {
		subject: string;
		author: string;
		rkey: string;
		createdAt: Date;
	}): Promise<void> {
		await this.query(
			`INSERT INTO likes (subject, author, rkey, created_at) VALUES (?, ?, ?, ?)`,
			[
				data.subject,
				data.author,
				data.rkey,
				Math.floor(data.createdAt.getTime() / 1000),
			],
		);
	}

	/**
	 * Delete a like record
	 */
	async deleteLike(rkey: string, author: string): Promise<void> {
		await this.query(`DELETE FROM likes WHERE rkey = ? AND author = ?`, [
			rkey,
			author,
		]);
	}

	/**
	 * Upsert a GIF record into global_gifs table
	 */
	async upsertGif(data: {
		uri: string;
		cid: string;
		author: string;
		title: string | null | undefined;
		alt: string | null | undefined;
		tags: string[] | null | undefined;
		file: unknown;
		createdAt: Date;
	}): Promise<void> {
		const tagsJson = data.tags ? JSON.stringify(data.tags) : null;
		const fileJson = JSON.stringify(data.file);
		const createdAtTimestamp = Math.floor(data.createdAt.getTime() / 1000);

		await this.query(
			`INSERT INTO global_gifs (uri, cid, author, title, alt, tags, file, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(uri) DO UPDATE SET
				 cid = excluded.cid,
				 title = excluded.title,
				 alt = excluded.alt,
				 tags = excluded.tags,
				 file = excluded.file,
				 created_at = excluded.created_at`,
			[
				data.uri,
				data.cid,
				data.author,
				data.title ?? null,
				data.alt ?? null,
				tagsJson,
				fileJson,
				createdAtTimestamp,
			],
		);
	}

	/**
	 * Delete a GIF record
	 */
	async deleteGif(uri: string): Promise<void> {
		await this.query(`DELETE FROM global_gifs WHERE uri = ?`, [uri]);
	}
}
