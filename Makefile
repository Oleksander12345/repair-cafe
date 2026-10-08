# Repair Café — точки входу для відтворення перевірок. Деталі: standards/checks.md
SHELL := /bin/bash
SHA   := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
PORT  ?= 3000

.PHONY: help install check lint format test deps build run version hook-demo clean

help:      ## список цілей
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

install:   ## залежності + git hooks (husky)
	npm ci

check:     ## ВСІ перевірки, як у hooks: формат, лінт, типи, архітектура, smoke, збірка
	npm run check

lint:      ## ESLint + Prettier --check
	npm run format:check && npm run lint

format:    ## автоформат
	npm run format

deps:      ## архітектурні правила (dependency-cruiser)
	npm run deps:check

test:      ## smoke-тести
	npm run test:smoke

build:     ## збірка TypeScript -> dist/
	npm run build

run: build ## запуск зібраного сервера з версією = поточний git sha
	GIT_SHA=$(SHA) PORT=$(PORT) node dist/server.js

version:   ## запитати /version у запущеного сервера
	@curl -s localhost:$(PORT)/version; echo

hook-demo: ## довести, що pre-commit блокує брудний коміт
	./scripts/hook-demo.sh

clean:
	rm -rf dist coverage
