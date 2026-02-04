import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "../../packages/common/src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	driver: "d1-http",
});
