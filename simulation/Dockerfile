FROM oven/bun:1-alpine

WORKDIR /app/simulation

COPY simulation/sim.ts ./
COPY types /app/types

CMD ["bun", "sim.ts"]