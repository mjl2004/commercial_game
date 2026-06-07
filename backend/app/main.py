from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db.connection import init_pool, close_pool
from app.api.routes import router as http_router
from app.api.websocket import router as ws_router
from app.config import settings
from app.services.auth_service import AuthService
from app.services.settlement_service import SettlementService
from app.services.session_store import SessionStore

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_pool()
        await SessionStore.ensure_table()
        await AuthService.ensure_tables()
        await SettlementService.ensure_tables()
    except Exception as e:
        print(f"[WARNING] Database connection failed: {e}")
    yield
    try:
        await close_pool()
    except Exception:
        pass

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(http_router, prefix="/api")
app.include_router(ws_router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
