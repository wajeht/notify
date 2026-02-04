FROM node:25-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY ./ ./

RUN npm run build

FROM node:25-alpine

RUN apk update && apk add --no-cache curl

RUN addgroup -g 1000 -S nodejs && adduser -S nodejs -u 1000

WORKDIR /usr/src/app

COPY --chown=nodejs:nodejs --from=build /usr/src/app ./

USER nodejs

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl -f http://localhost:80/healthz || exit 1

ENV APP_ENV production

CMD ["node", "--no-warnings", "dist/src/server.js"]
