import { likes } from '@jjalcloud/core';
import { IdResolver, MemoryCache } from '@atproto/identity';
import { Firehose } from '@atproto/sync';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const FIREHOSE_URL = process.env.FIREHOSE_URL || 'wss://bsky.network';

// Find D1 Database File
// Logic: Look for .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite in apps/web
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../');
const WEB_WRANGLER_DIR = path.join(WORKSPACE_ROOT, 'apps/web/.wrangler');

function findD1Database() {
    const d1StateDir = path.join(WEB_WRANGLER_DIR, 'state/v3/d1/miniflare-D1DatabaseObject');
    
    if (!fs.existsSync(d1StateDir)) {
        throw new Error(`D1 State Directory not found: ${d1StateDir}. Please run 'pnpm dev' in apps/web first.`);
    }

    const files = fs.readdirSync(d1StateDir).filter(f => f.endsWith('.sqlite'));
    if (files.length === 0) {
        throw new Error('No SQLite database found in .wrangler state.');
    }
    
    // Return the first one found (assuming single DB for now)
    return path.join(d1StateDir, files[0]);
}

async function main() {
    const logger = pino({ name: 'firehose', level: LOG_LEVEL });
    
    const dbPath = findD1Database();
    logger.info({ dbPath }, 'Found D1 Database');
    
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite);

    const firehose = new Firehose({
        filterCollections: ['com.jjalcloud.feed.like', 'com.jjalcloud.feed.gif'],
        handleEvent: async (evt) => {
            // Handle Like events
            if (evt.collection === 'com.jjalcloud.feed.like') {
                if (evt.event === 'create' || evt.event === 'update') {
                    const record = evt.record;
                    const subjectUri = record.subject?.uri;
                    const authorDid = evt.did;
                    
                    if (subjectUri && authorDid) {
                        logger.info({ uri: evt.uri, author: authorDid }, 'Indexing Like');
                        try {
                             db.insert(likes).values({
                                 subject: subjectUri,
                                 author: authorDid,
                                 rkey: evt.uri.toString().split('/').pop() || '',
                                 createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                             }).run();
                        } catch (err: any) {
                             logger.error({ err }, 'Failed to insert like');
                        }
                    }
                } else if (evt.event === 'delete') {
                    logger.info({ uri: evt.uri }, 'Deleting Like');
                    try {
                         // Simplify delete for now using raw query as 'likes' table might not match exactly what we thought or to be safe
                         // Assuming schema has 'rkey' and 'author' or specific ID? 
                         // The previous code had: sqlite.prepare('DELETE FROM likes WHERE uri = ?').run(evt.uri.toString());
                         // But schemas.ts for likes has: subject, author, rkey, createdAt. It DOES NOT have 'uri' column explicitly in the view above unless added?
                         // Let's re-read schema.ts carefully.
                         // schema.ts: likes has id, subject, author, rkey, createdAt. NO URI.
                         // So we must delete by rkey and author? Or just rkey if unique per collection?
                         // Rkey is unique within a collection (author). So author + rkey.
                         const rkey = evt.uri.toString().split('/').pop();
                         if (rkey) {
                             sqlite.prepare('DELETE FROM likes WHERE rkey = ? AND author = ?').run(rkey, evt.did);
                         }
                    } catch (err) {
                        logger.error({ err }, 'Failed to delete like');
                    }
                }
            }
            
            // Handle GIF events
            if (evt.collection === 'com.jjalcloud.feed.gif') {
                if (evt.event === 'create' || evt.event === 'update') {
                    const record = evt.record;
                    logger.info({ uri: evt.uri }, 'Indexing GIF');
                    
                    try {
                        const { globalGifs } = await import('@jjalcloud/core');
                        db.insert(globalGifs).values({
                            uri: evt.uri.toString(),
                            cid: evt.cid?.toString() || '',
                            author: evt.did,
                            title: record.title,
                            alt: record.alt,
                            tags: record.tags ? JSON.stringify(record.tags) : null,
                            file: record.file, // Stored as JSON
                            createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                        }).onConflictDoUpdate({
                            target: globalGifs.uri,
                            set: {
                                cid: evt.cid?.toString(),
                                title: record.title,
                                alt: record.alt,
                                tags: record.tags ? JSON.stringify(record.tags) : null,
                                file: record.file,
                                createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                            }
                        }).run();
                    } catch (err) {
                        logger.error({ err }, 'Failed to upsert GIF');
                    }
                } else if (evt.event === 'delete') {
                    logger.info({ uri: evt.uri }, 'Deleting GIF');
                    try {
                        const { globalGifs } = await import('@jjalcloud/core');
                        // Use better-sqlite3 directly if needed or drizzle
                        // db.delete(globalGifs).where(eq(globalGifs.uri, evt.uri.toString())).run();
                        // Since I can't easily import 'eq' here without potentially messing up imports, I'll use raw SQL for safety as before
                        sqlite.prepare('DELETE FROM global_gifs WHERE uri = ?').run(evt.uri.toString());
                    } catch (err) {
                        logger.error({ err }, 'Failed to delete GIF');
                    }
                }
            }
        },
        onError: (err) => {
            logger.error({ err }, 'Firehose Error');
        },
        service: FIREHOSE_URL,
        excludeIdentity: true,
        excludeAccount: true,
    });

    logger.info('Starting Firehose...');
    firehose.start();
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
