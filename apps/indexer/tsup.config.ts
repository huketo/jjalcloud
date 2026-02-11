import { cpSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	clean: true,
	noExternal: ["@jjalcloud/common"],
	external: ["zstd-napi"],
	onSuccess: async () => {
		cpSync("src/zstd_dictionary", "dist/zstd_dictionary");
	},
});
