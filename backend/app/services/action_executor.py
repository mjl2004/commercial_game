from dataclasses import dataclass
from typing import Any, Literal


ExecutionMode = Literal["auto", "reference_python", "database_native"]


@dataclass(slots=True)
class ActionExecutionContext:
    session_id: str
    action: str
    payload: dict[str, Any]
    random_control: dict[str, Any]
    input_session_version: int | None
    executor_used: ExecutionMode | None = None
