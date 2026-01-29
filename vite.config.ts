import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import ssrPlugin from "vite-ssr-components/plugin";
import UnoCSS from "unocss/vite";

export default defineConfig({
	plugins: [cloudflare(), ssrPlugin(), UnoCSS()],
	server: {
		host: "127.0.0.1",
		port: 5173,
	},
});
