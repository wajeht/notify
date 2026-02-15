FROM node:25-alpine@sha256:b9b5737eabd423ba73b21fe2e82332c0656d571daf1ebf19b0f89d0dd0d3ca93 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY ./ ./

RUN npm run build

FROM node:25-alpine@sha256:b9b5737eabd423ba73b21fe2e82332c0656d571daf1ebf19b0f89d0dd0d3ca93

RUN apk update && apk add --no-cache curl

WORKDIR /usr/src/app

COPY --chown=node:node --from=build /usr/src/app ./

USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl -f http://localhost:80/healthz || exit 1

ENV APP_ENV production

CMD ["node", "--no-warnings", "dist/src/server.js"]
