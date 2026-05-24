# AgentHub

AgentHub is an IM-style multi-agent collaboration platform for AI-assisted software development.

## Repository Layout

```text
frontend/       React + Vite client
backend-java/   Spring Boot IM/API service
backend-python/ FastAPI AI worker service
db/             Cross-service database notes
docs/           Requirements, high-level design, task breakdown
```

## Local Development

1. Copy `.env.example` to `.env` and adjust secrets.
2. Start the service stack:

```bash
docker compose up --build
```

Default ports:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Java API | http://localhost:18080/api/health |
| Python AI | http://localhost:8000/health |
| MySQL | localhost:3306 |
| Redis | localhost:6379 |
