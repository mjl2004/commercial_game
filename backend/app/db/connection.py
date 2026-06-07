import asyncpg
from app.config import settings
from contextlib import asynccontextmanager

_pool: asyncpg.Pool | None = None

async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
            statement_cache_size=0,
        )
    return _pool

async def close_pool() -> None:
    global _pool
    if _pool:
        try:
            await _pool.close()
        except RuntimeError:
            _pool.terminate()
        except AttributeError:
            _pool.terminate()
        _pool = None

async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        return await init_pool()
    return _pool

@asynccontextmanager
async def get_connection():
    pool = await get_pool()
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        try:
            await pool.release(conn)
        except asyncpg.FeatureNotSupportedError:
            # OpenGauss-lite 不支持 UNLISTEN 重置，安全忽略
            pass

@asynccontextmanager
async def transaction():
    async with get_connection() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            yield conn
            await tr.commit()
        except Exception:
            await tr.rollback()
            raise
