FROM node:26-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY server ./server
COPY nuxt.config.ts ./nuxt.config.ts

RUN npm run build

FROM node:26-alpine

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /workspace/.output ./.output

VOLUME /app/data
EXPOSE 3000

ENTRYPOINT ["node", ".output/server/index.mjs"]
