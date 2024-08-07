deploy:
	@./deploy.sh

push:
	@npm run format
	@git add -A
	@curl -s https://commit.up.railway.app/ | sh
	@git push --no-verify
