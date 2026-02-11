import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger } from "pino";
import WebSocket from "ws";
import { Decompressor } from "zstd-napi";

const DEFAULT_JETSTREAM_URL = "wss://jetstream2.us-east.bsky.network/subscribe";
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const CURSOR_SAFETY_MARGIN_US = 5_000_000; // 5 seconds in microseconds

/** Load the Jetstream zstd dictionary for decompression. */
function loadZstdDictionary(): Buffer {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(__dirname, "zstd_dictionary"));
}

/** Jetstream commit event operation types */
export type JetstreamOperation = "create" | "update" | "delete";

/** Jetstream commit event payload */
export interface JetstreamCommit {
	rev: string;
	operation: JetstreamOperation;
	collection: string;
	rkey: string;
	record?: Record<string, unknown>;
	cid?: string;
}

/** Jetstream commit event message */
export interface JetstreamCommitEvent {
	did: string;
	time_us: number;
	kind: "commit";
	commit: JetstreamCommit;
}

/** Jetstream identity event message */
export interface JetstreamIdentityEvent {
	did: string;
	time_us: number;
	kind: "identity";
	identity: {
		did: string;
		handle: string;
		seq: number;
		time: string;
	};
}

/** Jetstream account event message */
export interface JetstreamAccountEvent {
	did: string;
	time_us: number;
	kind: "account";
	account: {
		active: boolean;
		did: string;
		seq: number;
		time: string;
	};
}

export type JetstreamEvent =
	| JetstreamCommitEvent
	| JetstreamIdentityEvent
	| JetstreamAccountEvent;

export interface JetstreamClientOptions {
	/** WebSocket URL (without query params). Defaults to public Jetstream instance. */
	url?: string;
	/** Collections to subscribe to (server-side filter). */
	wantedCollections: string[];
	/** DIDs to subscribe to (server-side filter, max 10,000). */
	wantedDids?: string[];
	/** Enable zstd compression. Defaults to true. */
	compress?: boolean;
	/** Handler for commit events. */
	handleEvent: (event: JetstreamCommitEvent) => void | Promise<void>;
	/** Error handler. */
	onError?: (error: Error) => void;
	/** Logger instance. */
	logger: Logger;
}

export class JetstreamClient {
	private ws: WebSocket | null = null;
	private cursor: number | null = null;
	private reconnectDelay = RECONNECT_DELAY_MS;
	private destroyed = false;
	private decompressor: Decompressor | null = null;
	private readonly options: Required<
		Pick<
			JetstreamClientOptions,
			"url" | "wantedCollections" | "compress" | "logger"
		>
	> &
		JetstreamClientOptions;

	constructor(options: JetstreamClientOptions) {
		this.options = {
			url: DEFAULT_JETSTREAM_URL,
			compress: true,
			...options,
		};

		if (this.options.compress) {
			this.decompressor = new Decompressor();
			const dictionary = loadZstdDictionary();
			this.decompressor.loadDictionary(dictionary);
			this.options.logger.info(
				{ dictionarySize: dictionary.length },
				"Loaded zstd dictionary for Jetstream decompression",
			);
		}
	}

	/** Start the Jetstream WebSocket connection. */
	start(): void {
		this.destroyed = false;
		this.connect();
	}

	/** Destroy the client and close the connection. */
	destroy(): void {
		this.destroyed = true;
		if (this.ws) {
			this.ws.removeAllListeners();
			this.ws.close();
			this.ws = null;
		}
	}

	private buildUrl(): string {
		const url = new URL(this.options.url);

		for (const collection of this.options.wantedCollections) {
			url.searchParams.append("wantedCollections", collection);
		}

		if (this.options.wantedDids) {
			for (const did of this.options.wantedDids) {
				url.searchParams.append("wantedDids", did);
			}
		}

		if (this.options.compress) {
			url.searchParams.set("compress", "true");
		}

		if (this.cursor !== null) {
			// Subtract safety margin for gapless playback
			const safeCursor = this.cursor - CURSOR_SAFETY_MARGIN_US;
			url.searchParams.set("cursor", String(Math.max(0, safeCursor)));
		}

		return url.toString();
	}

	private connect(): void {
		if (this.destroyed) return;

		const url = this.buildUrl();
		this.options.logger.info(
			{ url: this.maskUrl(url) },
			"Connecting to Jetstream",
		);

		this.ws = new WebSocket(url, {
			perMessageDeflate: false,
		});

		this.ws.on("open", () => {
			this.options.logger.info("Connected to Jetstream");
			this.reconnectDelay = RECONNECT_DELAY_MS;
		});

		this.ws.on("message", (data: WebSocket.RawData) => {
			this.handleMessage(data);
		});

		this.ws.on("error", (err: Error) => {
			this.options.logger.error({ err }, "Jetstream WebSocket error");
			this.options.onError?.(err);
		});

		this.ws.on("close", (code: number, reason: Buffer) => {
			this.options.logger.warn(
				{ code, reason: reason.toString() },
				"Jetstream connection closed",
			);
			this.scheduleReconnect();
		});
	}

	private handleMessage(data: WebSocket.RawData): void {
		try {
			let json: string;

			if (this.options.compress && this.decompressor) {
				// Each message is independently zstd-compressed with the shared dictionary
				const compressed = Buffer.isBuffer(data)
					? data
					: Buffer.from(data as ArrayBuffer);
				const decompressed = this.decompressor.decompress(compressed);
				json = decompressed.toString("utf-8");
			} else {
				json = data.toString();
			}

			this.processEvent(json);
		} catch (err) {
			this.options.logger.error(
				{ err },
				"Failed to decompress/parse Jetstream message",
			);
		}
	}

	private processEvent(raw: string): void {
		try {
			const event = JSON.parse(raw) as JetstreamEvent;

			// Update cursor from every event
			if (event.time_us) {
				this.cursor = event.time_us;
			}

			// Only forward commit events to handler
			if (event.kind === "commit") {
				const commitEvent = event as JetstreamCommitEvent;
				const result = this.options.handleEvent(commitEvent);
				// If handler returns a promise, catch errors
				if (result instanceof Promise) {
					result.catch((err) => {
						this.options.logger.error(
							{ err, did: commitEvent.did },
							"Event handler error",
						);
					});
				}
			}
		} catch (err) {
			this.options.logger.error(
				{ err, raw: raw.slice(0, 200) },
				"Failed to parse Jetstream message",
			);
		}
	}

	private scheduleReconnect(): void {
		if (this.destroyed) return;

		this.options.logger.info(
			{ delayMs: this.reconnectDelay, cursor: this.cursor },
			"Scheduling reconnect",
		);

		setTimeout(() => {
			this.connect();
		}, this.reconnectDelay);

		// Exponential backoff with cap
		this.reconnectDelay = Math.min(
			this.reconnectDelay * 2,
			MAX_RECONNECT_DELAY_MS,
		);
	}

	/** Mask query params for logging (don't log full DIDs list). */
	private maskUrl(url: string): string {
		const parsed = new URL(url);
		const didCount = parsed.searchParams.getAll("wantedDids").length;
		if (didCount > 0) {
			// Remove individual DIDs, show count only
			const masked = new URL(url);
			masked.searchParams.delete("wantedDids");
			return `${masked.toString()}&wantedDids=[${didCount} DIDs]`;
		}
		return url;
	}
}
