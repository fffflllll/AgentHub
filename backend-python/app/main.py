from datetime import datetime, timezone

from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(title="AgentHub AI", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "agenthub-ai",
        "redis_url": settings.redis_url,
        "time": datetime.now(timezone.utc).isoformat(),
    }
