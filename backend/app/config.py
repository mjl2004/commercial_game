from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://shu:database%40123@127.0.0.1:5432/opengauss_commercial_game"
    app_name: str = "星际贸易模拟游戏后端"
    debug: bool = True
    ws_url: str = "ws://localhost:8000/ws"

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value

    class Config:
        env_file = ".env"


settings = Settings()
