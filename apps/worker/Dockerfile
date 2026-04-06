FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @elp/api prisma generate
RUN pnpm --filter @elp/worker build

EXPOSE 4100

CMD ["node", "apps/worker/dist/main.js"]
