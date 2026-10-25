.PHONY: help dev dev-backend dev-frontend test test-backend test-frontend lint format ingest clean

help:
	@echo "Available commands:"
	@echo "  make dev           - Start full application stack (Docker or local)"
	@echo "  make test          - Run backend (pytest) and frontend (vitest) tests"
	@echo "  make ingest        - Run Elexon BMRS ingestion pipeline for January 2026 data"
	@echo "  make lint          - Run ruff, black check, and frontend eslint"
	@echo "  make format        - Auto-format backend code with ruff and black"
	@echo "  make clean         - Remove cache files and artifacts"

dev:
	docker compose up --build

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && pytest

test-frontend:
	cd frontend && npm run test

lint:
	cd backend && ruff check . && black --check .
	cd frontend && npm run lint

format:
	cd backend && ruff check --fix . && black .

ingest:
	python scripts/ingest_bmrs.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
