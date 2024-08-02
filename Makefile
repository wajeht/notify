push:
	@git add -A
	@curl -s https://commit.jaw.dev/ | sh
	@git push --no-verify
