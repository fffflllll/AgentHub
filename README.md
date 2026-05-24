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
2. Validate the Compose file:

```bash
docker compose config
```

3. Start the service stack:

```bash
docker compose up --build
```

Default ports:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Java API via frontend proxy | http://localhost:3000/api/health |
| Java API direct debug port | http://localhost:18080/api/health |
| Python AI | http://localhost:8000/health |
| MySQL | localhost:3306 |
| Redis | localhost:6379 |

The production frontend container serves static assets and proxies `/api/*` and `/ws/*` to the Java API service through Nginx.
