FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS tooling
RUN npm install --global pnpm@11.1.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM tooling AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM tooling AS production-dependencies
RUN pnpm install --prod --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json LICENSE README.md llms.txt ./
COPY server/ ./server/
COPY src/workers/pocketTtsCore.ts src/workers/pocketTtsHelpers.ts ./src/workers/
RUN mkdir -p public/models/pocket-tts && chown -R node:node public
USER node
EXPOSE 3001
CMD ["node", "server/index.ts"]
