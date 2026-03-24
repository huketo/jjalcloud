import { describe, expect, it } from "bun:test";
import {
	autocompleteTags,
	getFeed,
	getLikeCount,
	getTrending,
	searchGifs,
	searchSuggestions,
} from "./search";

describe("search module", () => {
	it("exports searchGifs", () => expect(searchGifs).toBeFunction());
	it("exports autocompleteTags", () => expect(autocompleteTags).toBeFunction());
	it("exports searchSuggestions", () => expect(searchSuggestions).toBeFunction());
	it("exports getFeed", () => expect(getFeed).toBeFunction());
	it("exports getTrending", () => expect(getTrending).toBeFunction());
	it("exports getLikeCount", () => expect(getLikeCount).toBeFunction());
});
