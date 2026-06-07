from pydantic import BaseModel, Field, field_validator


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_email(value: str) -> str:
    normalized = _normalize_email(value)
    local, separator, domain = normalized.partition("@")
    if not separator or not local or not domain or "." not in domain:
        raise ValueError("Invalid email address")
    return normalized


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)
    nickname: str = Field(min_length=1, max_length=64)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class RecordScoreRequest(BaseModel):
    score: int = Field(ge=0)


class CompleteSettlementRequest(BaseModel):
    accountId: str | None = Field(default=None, min_length=1, max_length=64)
