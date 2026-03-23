import { defineLexiconConfig } from "@atcute/lex-cli";

export default defineLexiconConfig({
	files: ["src/lexicons/**/*.json"],
	outdir: "src/generated",
	mappings: [
		{
			nsid: ["com.atproto.*"],
			imports: (nsid) => {
				const specifier = nsid.slice("com.atproto.".length).replaceAll(".", "/");
				return { type: "namespace", from: `@atcute/atproto/types/${specifier}` };
			},
		},
		{
			nsid: ["app.bsky.*"],
			imports: (nsid) => {
				const specifier = nsid.slice("app.bsky.".length).replaceAll(".", "/");
				return { type: "namespace", from: `@atcute/bluesky/types/app/${specifier}` };
			},
		},
	],
});
