import type { Logger } from "pino";
import type { D1BatchQuery } from "./db/d1-http-driver.js";
import type { BatchExecutor } from "./db/index.js";

interface GifUpsert {
	uri: string;
	cid: string;
	author: string;
	title: string | null;
	alt: string | null;
	tags: string | null;
	file: string;
	width: number | null;
	height: number | null;
	createdAt: number;
}

interface GifDelete {
	uri: string;
}

interface LikeInsert {
	subject: string;
	author: string;
	rkey: string;
	createdAt: number;
}

interface LikeDelete {
	rkey: string;
	author: string;
}

interface BatcherConfig {
	maxBatchSize: number;
	flushIntervalMs: number;
	executeBatch: BatchExecutor;
	logger: Logger;
}

const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 500;

export class EventBatcher {
	private gifUpserts: GifUpsert[] = [];
	private gifDeletes: GifDelete[] = [];
	private likeInserts: LikeInsert[] = [];
	private likeDeletes: LikeDelete[] = [];
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private flushing = false;
	private readonly config: BatcherConfig;

	constructor(
		config: Partial<BatcherConfig> &
			Pick<BatcherConfig, "executeBatch" | "logger">,
	) {
		this.config = {
			maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
			flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
			...config,
		};
	}

	start(): void {
		this.flushTimer = setInterval(() => {
			this.flush().catch((err) => {
				this.config.logger.error({ err }, "Periodic flush failed");
			});
		}, this.config.flushIntervalMs);
	}

	private get pendingCount(): number {
		return (
			this.gifUpserts.length +
			this.gifDeletes.length +
			this.likeInserts.length +
			this.likeDeletes.length
		);
	}

	queueGifUpsert(data: {
		uri: string;
		cid: string;
		author: string;
		title: string | null | undefined;
		alt: string | null | undefined;
		tags: string[] | null | undefined;
		file: unknown;
		width: number | null | undefined;
		height: number | null | undefined;
		createdAt: Date;
	}): void {
		this.gifUpserts.push({
			uri: data.uri,
			cid: data.cid,
			author: data.author,
			title: data.title ?? null,
			alt: data.alt ?? null,
			tags: data.tags ? JSON.stringify(data.tags) : null,
			file: JSON.stringify(data.file),
			width: data.width ?? null,
			height: data.height ?? null,
			createdAt: Math.floor(data.createdAt.getTime() / 1000),
		});
		this.flushIfNeeded();
	}

	queueGifDelete(uri: string): void {
		this.gifDeletes.push({ uri });
		this.flushIfNeeded();
	}

	queueLikeInsert(data: {
		subject: string;
		author: string;
		rkey: string;
		createdAt: Date;
	}): void {
		this.likeInserts.push({
			subject: data.subject,
			author: data.author,
			rkey: data.rkey,
			createdAt: Math.floor(data.createdAt.getTime() / 1000),
		});
		this.flushIfNeeded();
	}

	queueLikeDelete(rkey: string, author: string): void {
		this.likeDeletes.push({ rkey, author });
		this.flushIfNeeded();
	}

	private flushIfNeeded(): void {
		if (this.pendingCount >= this.config.maxBatchSize) {
			this.flush().catch((err) => {
				this.config.logger.error({ err }, "Threshold flush failed");
			});
		}
	}

	async flush(): Promise<void> {
		if (this.flushing || this.pendingCount === 0) return;

		this.flushing = true;

		const upserts = this.gifUpserts.splice(0);
		const deletes = this.gifDeletes.splice(0);
		const likeIns = this.likeInserts.splice(0);
		const likeDels = this.likeDeletes.splice(0);

		const queries: D1BatchQuery[] = [];

		for (const g of upserts) {
			queries.push({
				sql: `INSERT INTO gifs (uri, cid, author, title, alt, tags, file, width, height, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(uri) DO UPDATE SET
  cid = excluded.cid,
  title = excluded.title,
  alt = excluded.alt,
  tags = excluded.tags,
  file = excluded.file,
  width = excluded.width,
  height = excluded.height,
  created_at = excluded.created_at`,
				params: [
					g.uri,
					g.cid,
					g.author,
					g.title,
					g.alt,
					g.tags,
					g.file,
					g.width,
					g.height,
					g.createdAt,
				],
			});
		}

		for (const d of deletes) {
			queries.push({
				sql: "DELETE FROM gifs WHERE uri = ?",
				params: [d.uri],
			});
		}

		for (const l of likeIns) {
			queries.push({
				sql: "INSERT INTO likes (subject, author, rkey, created_at) VALUES (?, ?, ?, ?)",
				params: [l.subject, l.author, l.rkey, l.createdAt],
			});
		}

		for (const l of likeDels) {
			queries.push({
				sql: "DELETE FROM likes WHERE rkey = ? AND author = ?",
				params: [l.rkey, l.author],
			});
		}

		const total = queries.length;

		try {
			this.config.logger.info(
				{
					gifUpserts: upserts.length,
					gifDeletes: deletes.length,
					likeInserts: likeIns.length,
					likeDeletes: likeDels.length,
					total,
				},
				"Flushing batch",
			);
			await this.config.executeBatch(queries);
		} catch (err) {
			this.config.logger.error({ err, total }, "Batch flush failed");
		} finally {
			this.flushing = false;
		}
	}

	async stop(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		await this.flush();
	}
}
