FROM oven/bun:1-alpine AS builder

WORKDIR /app/batcher

COPY batcher/package.json batcher/bun.lock ./
RUN bun install --production --frozen-lockfile

COPY batcher ./
COPY types /app/types

RUN bun build --compile --minify index.ts --outfile /batcher

FROM alpine:3.21

RUN apk add --no-cache libgcc libstdc++

COPY --from=builder /batcher /batcher

EXPOSE 4000
CMD ["/batcher"]