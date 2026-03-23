/**
 * D1 (SQLite) → PostgreSQL Migration Script
 *
 * Reads a D1 SQL export and inserts data into the v2 PostgreSQL database.
 *
 * Usage:
 *   1. Export D1: npx wrangler d1 export jjalcloud_db --remote --output=d1-export.sql
 *   2. Run: DATABASE_URL=<pg-url> bun run scripts/migrate-d1.ts [--file d1-export.sql] [--dry-run]
 *
 * Transformations:
 *   - INTEGER timestamps (Unix epoch seconds) → TIMESTAMPTZ
 *   - gifs.tags (JSON string) → separate tags table rows
 *   - gifs.uri → extract rkey (last segment after /)
 *   - file (JSON text) → JSONB
 */

import { readFileSync } from "node:fs";
import { SQL } from "bun";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileIdx = args.indexOf("--file");
const exportFile = fileIdx !== -1 ? args[fileIdx + 1]! : "d1-export.sql";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL environment variable required");
	process.exit(1);
}

const sql = new SQL(DATABASE_URL);

interface D1User {
	did: string;
	handle: string;
	display_name: string | null;
	avatar: string | null;
	created_at: number;
	last_login_at: number;
}

interface D1Gif {
	uri: string;
	cid: string;
	author: string;
	title: string | null;
	alt: string | null;
	tags: string | null;
	file: string;
	width: number | null;
	height: number | null;
	created_at: number;
}

interface D1Like {
	id: number;
	subject: string;
	author: string;
	rkey: string;
	created_at: number;
}

function epochToTimestamp(epoch: number): Date {
	// D1 stores as Unix seconds
	return new Date(epoch * 1000);
}

function extractRkey(uri: string): string {
	const parts = uri.split("/");
	return parts[parts.length - 1]!;
}

function parseTags(tagsStr: string | null): string[] {
	if (!tagsStr) return [];
	try {
		const parsed = JSON.parse(tagsStr);
		if (Array.isArray(parsed)) return parsed.filter((t) => typeof t === "string");
	} catch {
		// Try comma-separated fallback
		return tagsStr
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
	}
	return [];
}

/**
 * Parse INSERT statements from SQLite dump.
 * Handles multi-row INSERTs and quoted values.
 */
function parseInserts(dump: string, tableName: string): string[][] {
	const rows: string[][] = [];
	const regex = new RegExp(`INSERT INTO "${tableName}"\\s+VALUES\\s*(.+?);`, "gis");

	for (const match of dump.matchAll(regex)) {
		const valuesStr = match[1]!;
		// Split by ),( to get individual rows
		const rowStrings = valuesStr.split(/\)\s*,\s*\(/);

		for (let rowStr of rowStrings) {
			// Clean leading/trailing parens
			rowStr = rowStr.replace(/^\(/, "").replace(/\)$/, "");

			const values: string[] = [];
			let current = "";
			let inQuote = false;
			let quoteChar = "";

			for (let i = 0; i < rowStr.length; i++) {
				const ch = rowStr[i]!;

				if (inQuote) {
					if (ch === quoteChar) {
						if (i + 1 < rowStr.length && rowStr[i + 1] === quoteChar) {
							// Escaped quote
							current += ch;
							i++;
						} else {
							inQuote = false;
						}
					} else {
						current += ch;
					}
				} else if (ch === "'" || ch === '"') {
					inQuote = true;
					quoteChar = ch;
				} else if (ch === ",") {
					values.push(current.trim());
					current = "";
				} else {
					current += ch;
				}
			}
			values.push(current.trim());
			rows.push(values);
		}
	}

	return rows;
}

function parseValue(val: string): string | number | null {
	if (val === "NULL" || val === "null") return null;
	const num = Number(val);
	if (!Number.isNaN(num) && val !== "") return num;
	return val;
}

async function migrate() {
	console.log(`Reading ${exportFile}...`);
	const dump = readFileSync(exportFile, "utf-8");
	console.log(`Read ${dump.length} bytes.`);

	// --- Users ---
	const userRows = parseInserts(dump, "users");
	console.log(`Found ${userRows.length} users.`);

	for (const row of userRows) {
		const user: D1User = {
			did: row[0] as string,
			handle: row[1] as string,
			display_name: parseValue(row[2]!) as string | null,
			avatar: parseValue(row[3]!) as string | null,
			created_at: Number(row[4]),
			last_login_at: Number(row[5]),
		};

		if (dryRun) {
			console.log(`[dry-run] user: ${user.did} (${user.handle})`);
			continue;
		}

		await sql`
			INSERT INTO users (did, handle, display_name, avatar, created_at, last_login_at)
			VALUES (${user.did}, ${user.handle}, ${user.display_name}, ${user.avatar},
				${epochToTimestamp(user.created_at)}, ${epochToTimestamp(user.last_login_at)})
			ON CONFLICT (did) DO NOTHING
		`;
	}
	console.log(`Migrated ${userRows.length} users.`);

	// --- GIFs ---
	const gifRows = parseInserts(dump, "gifs");
	console.log(`Found ${gifRows.length} gifs.`);

	let tagCount = 0;
	for (const row of gifRows) {
		const gif: D1Gif = {
			uri: row[0] as string,
			cid: row[1] as string,
			author: row[2] as string,
			title: parseValue(row[3]!) as string | null,
			alt: parseValue(row[4]!) as string | null,
			tags: parseValue(row[5]!) as string | null,
			file: row[6] as string,
			width: parseValue(row[7]!) as number | null,
			height: parseValue(row[8]!) as number | null,
			created_at: Number(row[9]),
		};

		const rkey = extractRkey(gif.uri);
		const fileJson = typeof gif.file === "string" ? JSON.parse(gif.file) : gif.file;
		const tagList = parseTags(gif.tags);

		if (dryRun) {
			console.log(`[dry-run] gif: ${gif.uri} (${tagList.length} tags)`);
			continue;
		}

		await sql`
			INSERT INTO gifs (uri, cid, author, rkey, title, alt, width, height, file, created_at)
			VALUES (${gif.uri}, ${gif.cid}, ${gif.author}, ${rkey}, ${gif.title}, ${gif.alt},
				${gif.width}, ${gif.height}, ${JSON.stringify(fileJson)}::jsonb,
				${epochToTimestamp(gif.created_at)})
			ON CONFLICT (uri) DO NOTHING
		`;

		// Insert tags into separate table
		for (const tag of tagList) {
			await sql`
				INSERT INTO tags (gif_uri, name) VALUES (${gif.uri}, ${tag})
			`;
			tagCount++;
		}
	}
	console.log(`Migrated ${gifRows.length} gifs, ${tagCount} tags.`);

	// --- Likes ---
	const likeRows = parseInserts(dump, "likes");
	console.log(`Found ${likeRows.length} likes.`);

	for (const row of likeRows) {
		const like: D1Like = {
			id: Number(row[0]),
			subject: row[1] as string,
			author: row[2] as string,
			rkey: row[3] as string,
			created_at: Number(row[4]),
		};

		if (dryRun) {
			console.log(`[dry-run] like: ${like.author} → ${like.subject}`);
			continue;
		}

		await sql`
			INSERT INTO likes (subject, author, rkey, created_at)
			VALUES (${like.subject}, ${like.author}, ${like.rkey},
				${epochToTimestamp(like.created_at)})
			ON CONFLICT (author, rkey) DO NOTHING
		`;
	}
	console.log(`Migrated ${likeRows.length} likes.`);

	// --- Summary ---
	if (!dryRun) {
		const [{ count: userCount }] = await sql`SELECT count(*)::int AS count FROM users`;
		const [{ count: gifCount }] = await sql`SELECT count(*)::int AS count FROM gifs`;
		const [{ count: totalTags }] = await sql`SELECT count(*)::int AS count FROM tags`;
		const [{ count: likeCount }] = await sql`SELECT count(*)::int AS count FROM likes`;

		console.log("");
		console.log("=== Migration Complete ===");
		console.log(`Users: ${userCount}`);
		console.log(`GIFs:  ${gifCount}`);
		console.log(`Tags:  ${totalTags}`);
		console.log(`Likes: ${likeCount}`);
	} else {
		console.log("\n[dry-run] No data was written.");
	}

	sql.close();
}

migrate().catch((e) => {
	console.error("Migration failed:", e);
	process.exit(1);
});
