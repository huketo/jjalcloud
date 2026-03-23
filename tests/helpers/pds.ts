const PDS_URL = process.env.PDS_URL ?? "http://localhost:2583";

interface TestAccount {
	did: string;
	handle: string;
	accessJwt: string;
	refreshJwt: string;
}

/** Create a test account on the local PDS */
export async function createTestAccount(
	handle: string,
	password = "test-pass-123",
): Promise<TestAccount> {
	const email = `${handle.replace(".test", "")}@test.local`;

	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createAccount`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ handle, email, password }),
	});

	if (!res.ok) {
		const text = await res.text();
		if (text.includes("already") || text.includes("taken")) {
			return loginTestAccount(handle, password);
		}
		throw new Error(`Failed to create account ${handle}: ${text}`);
	}

	const data = await res.json();
	return {
		did: data.did,
		handle: data.handle,
		accessJwt: data.accessJwt,
		refreshJwt: data.refreshJwt,
	};
}

/** Login to an existing test account */
export async function loginTestAccount(
	identifier: string,
	password = "test-pass-123",
): Promise<TestAccount> {
	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createSession`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ identifier, password }),
	});

	if (!res.ok) throw new Error(`Failed to login ${identifier}: ${await res.text()}`);

	const data = await res.json();
	return {
		did: data.did,
		handle: data.handle,
		accessJwt: data.accessJwt,
		refreshJwt: data.refreshJwt,
	};
}

/** Upload a blob to PDS */
export async function uploadBlob(account: TestAccount, data: Buffer, mimeType: string) {
	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.uploadBlob`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${account.accessJwt}`,
			"Content-Type": mimeType,
		},
		body: data,
	});

	if (!res.ok) throw new Error(`Failed to upload blob: ${await res.text()}`);
	return (await res.json()).blob;
}

/** Create a record on PDS */
export async function createRecord(
	account: TestAccount,
	collection: string,
	record: unknown,
	rkey?: string,
) {
	const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.createRecord`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${account.accessJwt}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			repo: account.did,
			collection,
			rkey,
			record,
		}),
	});

	if (!res.ok) throw new Error(`Failed to create record: ${await res.text()}`);
	return res.json();
}

/** Check if PDS is healthy */
export async function isPdsHealthy(): Promise<boolean> {
	try {
		const res = await fetch(`${PDS_URL}/xrpc/_health`);
		return res.ok;
	} catch {
		return false;
	}
}
