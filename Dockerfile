FROM node:25-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY ./ ./

RUN npm run build

FROM node:25-alpine

RUN apk update && apk add --no-cache curl

WORKDIR /usr/src/app

COPY --chown=node:node --from=build /usr/src/app ./

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl -f http://localhost:80/healthz || exit 1

ENV APP_ENV production

CMD ["node", "--no-warnings", "dist/src/server.js"]
