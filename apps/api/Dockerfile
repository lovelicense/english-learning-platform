FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @elp/api prisma generate
RUN pnpm --filter @elp/api build

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @elp/api prisma db push && pnpm --filter @elp/api start"]
