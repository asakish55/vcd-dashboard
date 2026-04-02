# ─────────────────────────────────────────────────────────────────────────────
# VCD Dashboard – Makefile shortcuts
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: start stop restart build logs clean dev status

## Start containers in background (production)
start:
	docker compose up -d

## Stop all containers
stop:
	docker compose down

## Restart all containers
restart:
	docker compose restart

## Rebuild images (use after code changes)
build:
	docker compose build --no-cache

## Rebuild and restart
rebuild: build start

## View live logs (Ctrl+C to exit)
logs:
	docker compose logs -f

## View backend logs only
logs-backend:
	docker compose logs -f backend

## View frontend logs only
logs-frontend:
	docker compose logs -f frontend

## Show container status
status:
	docker compose ps

## Start in development mode (hot reload)
dev:
	docker compose -f docker-compose.dev.yml up

## Stop development mode
dev-stop:
	docker compose -f docker-compose.dev.yml down

## Clean up everything (containers + images)
clean:
	docker compose down --rmi all --volumes --remove-orphans

## Pull latest base images
pull:
	docker compose pull
