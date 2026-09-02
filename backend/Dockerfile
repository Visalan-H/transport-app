FROM oven/bun:1-alpine AS builder

WORKDIR /app/backend

COPY backend/package.json backend/bun.lock ./
RUN bun install --production --frozen-lockfile

COPY backend ./
COPY types /app/types

RUN bun build --compile --minify server.ts --outfile /server
FROM alpine:3.21

RUN apk add --no-cache libgcc libstdc++

COPY --from=builder /server /server

# The server ran as root purely because nothing said otherwise. It binds 3000, which is
# unprivileged, and writes nothing to disk -- state is in memory and in Neon -- so it has no need
# for root, and a remote-code-execution bug in it would otherwise start with full container root.
RUN addgroup -S polaris && adduser -S -G polaris polaris
USER polaris

EXPOSE 3000
CMD ["/server"]