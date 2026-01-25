# 💻 Development

Clone the repository

```bash
$ git clone https://github.com/wajeht/notify.git
```

Copy `.env.example` to `.env` and update all the necessary environment variables.

```bash
$ cp .env.example .env
```

Install dependencies

```bash
$ npm install
```

Run development server

```bash
$ npm run dev
```

Run test

```bash
$ npm npm test
```

Format code

```bash
$ npm run format
```

Lint code

```bash
$ npm run lint
```

## 🐳 Docker

Copy `.env.example` to `.env` and update all the necessary environment variables.

```bash
$ cp .env.example .env
```

Run development server

```bash
$ docker compose -f docker-compose.yml up

```

Run test

```bash
$ docker compose -f docker-compose.yml exec notify npm run test

```

Format code

```bash
$ docker compose -f docker-compose.yml exec notify npm run format
```

Lint code

```bash
$ docker compose -f docker-compose.yml exec notify npm run lint
```
