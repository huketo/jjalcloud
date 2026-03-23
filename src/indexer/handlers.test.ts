import { describe, expect, it } from "bun:test";
import { handleGifCreate, handleGifDelete, handleLikeCreate, handleLikeDelete } from "./handlers";

describe("indexer handlers", () => {
	it("exports handleGifCreate", () => expect(handleGifCreate).toBeFunction());
	it("exports handleGifDelete", () => expect(handleGifDelete).toBeFunction());
	it("exports handleLikeCreate", () => expect(handleLikeCreate).toBeFunction());
	it("exports handleLikeDelete", () => expect(handleLikeDelete).toBeFunction());
});
