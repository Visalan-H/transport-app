FROM oven/bun:1

WORKDIR /app/backend

COPY backend/package.json backend/bun.lock ./
RUN bun install --production --frozen-lockfile

COPY backend ./
COPY types /app/types

EXPOSE 3000
CMD ["bun", "server.ts"]