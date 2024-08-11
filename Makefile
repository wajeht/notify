push:
	@make test
	@make lint
	@make format
	@git add -A
	@curl -s https://commit.jaw.dev | sh
	@git push --no-verify

fix-git:
	@git rm -r --cached . -f
	@git add .
	@git commit -m "Untrack files in .gitignore"

test:
	@docker compose -f docker-compose.dev.yml exec notify npm run test

test-ete:
	@docker compose -f docker-compose.dev.yml exec notify npm run test:ete

test-w:
	@docker compose -f docker-compose.dev.yml exec notify npm run test:watch

format:
	@docker compose -f docker-compose.dev.yml exec notify npm run format

lint:
	@docker compose -f docker-compose.dev.yml exec notify npm run lint

deploy:
	@./deploy.sh

shell:
	@docker compose -f docker-compose.dev.yml exec notify sh

db-migrate:
	@docker compose -f docker-compose.dev.yml exec notify npm run migrate:latest

db-rollback:
	@docker compose -f docker-compose.dev.yml exec notify npm run migrate:rollback

db-seed:
	@docker compose -f docker-compose.dev.yml exec notify npm run seed:run

up:
	@docker compose -f docker-compose.dev.yml up

up-d:
	@docker compose -f docker-compose.dev.yml up -d

log:
	@docker compose -f docker-compose.dev.yml logs -f

down:
	@docker compose -f docker-compose.dev.yml down

clean:
	@rm -rf ./dist
	@docker compose -f docker-compose.dev.yml down --rmi all
	@docker system prune -a --volumes -f
	@docker volume ls -qf dangling=true | xargs -r docker volume rm
