FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS build

WORKDIR /usr/src/app

COPY package*.json .npmrc ./

RUN npm ci && \
    npm rebuild better-sqlite3 esbuild --ignore-scripts=false

COPY ./ ./

RUN npm run build

FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4

RUN apk update && apk add --no-cache curl

WORKDIR /usr/src/app

COPY --chown=node:node --from=build /usr/src/app ./

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl -f http://localhost:80/healthz || exit 1

ENV APP_ENV production

CMD ["node", "--no-warnings", "dist/src/server.js"]
