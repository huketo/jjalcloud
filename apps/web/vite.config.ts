import { cloudflare } from "@cloudflare/vite-plugin";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
	plugins: [
		checker({ typescript: true }),
		cloudflare({
			configPath: "wrangler.jsonc",
			persistState: {
				path: ".wrangler/state",
			},
		}),
		ssrPlugin(),
		UnoCSS(),
	],
	server: {
		host: "127.0.0.1",
		port: 5173,
	},
});
