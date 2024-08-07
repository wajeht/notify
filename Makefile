deploy:
	@./deploy.sh

push:
	@npm run lint
	@npm run format
	@git add -A
	@curl -s https://commit.up.railway.app/ | sh
	@git push --no-verify
