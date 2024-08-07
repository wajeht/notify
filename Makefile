deploy:
	@./deploy.sh
push:
	@git add -A
	@curl -s https://commit.up.railway.app/ | sh
	@git push --no-verify
