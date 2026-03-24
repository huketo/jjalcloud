import { describe, expect, it } from "bun:test";
import { PostgresSessionStore } from "./session-store";
import { PostgresStateStore } from "./state-store";

describe("PostgresStateStore", () => {
	it("implements StateStore interface", () => {
		const store = new PostgresStateStore({} as any);
		expect(store.get).toBeFunction();
		expect(store.set).toBeFunction();
		expect(store.delete).toBeFunction();
		expect(store.clear).toBeFunction();
	});
});

describe("PostgresSessionStore", () => {
	it("implements SessionStore interface", () => {
		const store = new PostgresSessionStore({} as any);
		expect(store.get).toBeFunction();
		expect(store.set).toBeFunction();
		expect(store.delete).toBeFunction();
		expect(store.clear).toBeFunction();
	});
});
