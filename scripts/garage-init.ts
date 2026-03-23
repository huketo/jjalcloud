/**
 * Garage initialization script (Bun)
 * Sets up layout, creates API key and bucket, writes .env.test
 */

const GARAGE_ADMIN = "http://localhost:3903";
const ADMIN_TOKEN = "jjalcloud-admin-token";
const ENV_FILE = ".env.test";

const headers = {
	Authorization: `Bearer ${ADMIN_TOKEN}`,
	"Content-Type": "application/json",
};

async function waitForGarage() {
	console.log("Waiting for Garage admin API...");
	for (let i = 0; i < 30; i++) {
		try {
			const res = await fetch(`${GARAGE_ADMIN}/health`);
			if (res.ok) {
				console.log("Garage is ready.");
				return;
			}
		} catch {}
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error("Garage not ready after 30s");
}

async function api(method: string, path: string, body?: unknown) {
	const res = await fetch(`${GARAGE_ADMIN}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Garage API ${method} ${path} failed (${res.status}): ${text}`);
	}
	const text = await res.text();
	return text ? JSON.parse(text) : null;
}

async function main() {
	await waitForGarage();

	// Get node ID
	const status = await api("GET", "/v1/status");
	const nodeId: string = status.node;
	console.log(`Node ID: ${nodeId}`);

	// Apply layout (v1.1.0 expects an array of node assignments)
	await api("POST", "/v1/layout", [{ id: nodeId, zone: "dc1", capacity: 1073741824, tags: [] }]);

	// Get layout version and apply
	const layout = await api("GET", "/v1/layout");
	await api("POST", "/v1/layout/apply", { version: layout.version + 1 });
	console.log("Layout applied.");

	// Create API key
	const key = await api("POST", "/v1/key", { name: "jjalcloud" });
	const accessKey: string = key.accessKeyId;
	const secretKey: string = key.secretAccessKey;
	console.log("API key created.");

	// Create bucket
	const bucket = await api("POST", "/v1/bucket", { globalAlias: "jjalcloud-gifs" });
	const bucketId: string = bucket.id;

	// Grant key access
	await api("POST", "/v1/bucket/allow", {
		bucketId,
		accessKeyId: accessKey,
		permissions: { read: true, write: true, owner: true },
	});
	console.log("Bucket 'jjalcloud-gifs' created.");

	// Write .env.test
	const envContent = `DATABASE_URL=postgres://jjalcloud:jjalcloud@localhost:5432/jjalcloud_test
R2_ENDPOINT=http://localhost:3900
R2_ACCESS_KEY_ID=${accessKey}
R2_SECRET_ACCESS_KEY=${secretKey}
R2_BUCKET=jjalcloud-gifs
R2_PUBLIC_URL=http://localhost:3900/jjalcloud-gifs
R2_REGION=garage
OAUTH_CLIENT_ID=http://localhost:3000
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_PRIVATE_KEY={}
PUBLIC_URL=http://localhost:3000
JETSTREAM_URLS=wss://jetstream1.us-east.bsky.network/subscribe,wss://jetstream2.us-east.bsky.network/subscribe
PDS_URL=http://localhost:2583
`;
	await Bun.write(ENV_FILE, envContent);

	console.log("");
	console.log("=== Garage initialized ===");
	console.log(`Credentials written to ${ENV_FILE}`);
	console.log(`S3_ENDPOINT=http://localhost:3900`);
	console.log(`S3_ACCESS_KEY_ID=${accessKey}`);
	console.log(`S3_SECRET_ACCESS_KEY=${secretKey}`);
}

main().catch((e) => {
	console.error("Failed:", e.message);
	process.exit(1);
});
