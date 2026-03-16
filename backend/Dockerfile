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

EXPOSE 3000
CMD ["/server"]