FROM oven/bun:1

WORKDIR /app/batcher

COPY batcher/package.json batcher/bun.lock ./
RUN bun install --production --frozen-lockfile

COPY batcher ./
COPY types /app/types

EXPOSE 4000
CMD ["bun", "index.ts"]