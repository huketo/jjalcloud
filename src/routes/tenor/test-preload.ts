// This file is loaded as a Bun test preload (via bunfig.toml [test] preload).
// It runs before any test file module graph is evaluated, so process.env
// assignments here are visible when src/env.ts runs envSchema.parse(process.env).

process.env.DATABASE_URL = "postgres://test";
process.env.R2_ENDPOINT = "https://r2.example.com";
process.env.R2_ACCESS_KEY_ID = "test";
process.env.R2_SECRET_ACCESS_KEY = "test";
process.env.R2_BUCKET = "test";
process.env.R2_PUBLIC_URL = "https://cdn.jjalcloud.com";
process.env.OAUTH_CLIENT_ID = "test";
process.env.OAUTH_REDIRECT_URI = "https://jjalcloud.com/oauth/callback";
process.env.OAUTH_PRIVATE_KEY = "{}";
process.env.PUBLIC_URL = "https://jjalcloud.com";
