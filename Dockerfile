FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM install AS build
COPY . .
RUN bun run build

FROM base AS release
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist

# Install ffmpeg for video conversion
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
