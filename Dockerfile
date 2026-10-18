FROM node:26-bookworm-slim AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY public ./public
COPY server ./server
COPY nuxt.config.ts ./nuxt.config.ts
COPY runtime/similarity/features.mjs ./runtime/similarity/features.mjs

RUN npm run build

FROM node:26-bookworm-slim AS similarity

WORKDIR /app/runtime/similarity
COPY runtime/similarity/package.json runtime/similarity/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY runtime/similarity/*.mjs ./

FROM node:26-bookworm-slim

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /workspace/.output ./.output
COPY --from=similarity /app/runtime/similarity ./runtime/similarity

VOLUME /app/data
EXPOSE 3000

ENTRYPOINT ["node", ".output/server/index.mjs"]
