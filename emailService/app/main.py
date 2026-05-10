import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from app import scheduler
from app.routes import router

# Prefer .env.local (gitignored, real creds) over .env (template-only).
_env_local = Path(__file__).resolve().parent.parent / ".env.local"
_env = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_local if _env_local.exists() else _env)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(
    title="Email Service",
    description="Sends medical reports to patients via email.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
