FROM oven/bun:1-alpine AS builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend ./
COPY types /app/types

RUN bun run build

FROM nginx:alpine-slim

# openssl is only for the self-signed fallback in docker-entrypoint.d below. The base image does
# not carry it, and nginx will not start with an ssl_certificate path that does not resolve.
RUN apk add --no-cache openssl

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# The nginx entrypoint runs everything in this directory before starting the server. The +x is set
# here rather than relied on from git, which does not preserve the bit on every checkout.
COPY frontend/docker-entrypoint.d/10-tls-fallback.sh /docker-entrypoint.d/10-tls-fallback.sh
RUN chmod +x /docker-entrypoint.d/10-tls-fallback.sh

EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]