import type { Logger } from "pino";
import type {
	BatchExecutor,
	GifDeleteData,
	GifUpsertData,
	LikeDeleteData,
	LikeInsertData,
} from "./db/index.js";

interface BatcherConfig {
	maxBatchSize: number;
	flushIntervalMs: number;
	retryMaxAttempts: number;
	retryBaseDelayMs: number;
	executeBatch: BatchExecutor;
	logger: Logger;
}

const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 500;
const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

export class EventBatcher {
	private gifUpserts: GifUpsertData[] = [];
	private gifDeletes: GifDeleteData[] = [];
	private likeInserts: LikeInsertData[] = [];
	private likeDeletes: LikeDeleteData[] = [];
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
			retryMaxAttempts: config.retryMaxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS,
			retryBaseDelayMs: config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
			...config,
		};
	}

	private async sleep(ms: number): Promise<void> {
		await new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	private requeueFailedBatch(
		upserts: GifUpsertData[],
		deletes: GifDeleteData[],
		likeInserts: LikeInsertData[],
		likeDeletes: LikeDeleteData[],
	): void {
		this.gifUpserts = upserts.concat(this.gifUpserts);
		this.gifDeletes = deletes.concat(this.gifDeletes);
		this.likeInserts = likeInserts.concat(this.likeInserts);
		this.likeDeletes = likeDeletes.concat(this.likeDeletes);
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
			tags: data.tags,
			file: data.file,
			width: data.width ?? null,
			height: data.height ?? null,
			createdAt: data.createdAt,
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
			createdAt: data.createdAt,
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

		const total =
			upserts.length + deletes.length + likeIns.length + likeDels.length;

		try {
			let lastError: unknown;

			for (
				let attempt = 1;
				attempt <= this.config.retryMaxAttempts;
				attempt++
			) {
				try {
					this.config.logger.info(
						{
							gifUpserts: upserts.length,
							gifDeletes: deletes.length,
							likeInserts: likeIns.length,
							likeDeletes: likeDels.length,
							total,
							attempt,
							maxAttempts: this.config.retryMaxAttempts,
						},
						"Flushing batch",
					);

					await this.config.executeBatch({
						gifUpserts: upserts,
						gifDeletes: deletes,
						likeInserts: likeIns,
						likeDeletes: likeDels,
					});

					return;
				} catch (err) {
					lastError = err;

					if (attempt >= this.config.retryMaxAttempts) {
						break;
					}

					const retryDelayMs =
						this.config.retryBaseDelayMs * 2 ** (attempt - 1);
					this.config.logger.warn(
						{
							err,
							total,
							attempt,
							maxAttempts: this.config.retryMaxAttempts,
							retryDelayMs,
						},
						"Batch flush attempt failed, retrying",
					);
					await this.sleep(retryDelayMs);
				}
			}

			this.config.logger.error(
				{
					err: lastError,
					total,
					attempts: this.config.retryMaxAttempts,
				},
				"Batch flush failed after retries",
			);
			this.requeueFailedBatch(upserts, deletes, likeIns, likeDels);
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
