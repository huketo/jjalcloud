import { describe, expect, it } from "bun:test";
import * as schema from "./schema";

describe("schema", () => {
	it("exports all tables", () => {
		expect(schema.users).toBeDefined();
		expect(schema.gifs).toBeDefined();
		expect(schema.tags).toBeDefined();
		expect(schema.likes).toBeDefined();
		expect(schema.categories).toBeDefined();
		expect(schema.shareEvents).toBeDefined();
		expect(schema.oauthStates).toBeDefined();
		expect(schema.oauthSessions).toBeDefined();
	});
});
