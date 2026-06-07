from importlib import import_module

__all__ = [
    "AuthService",
    "GameplayService",
    "SessionService",
    "TradeService",
    "WantedService",
    "MonopolyService",
    "EventService",
    "SettlementService",
]


def __getattr__(name: str):
    service_modules = {
        "AuthService": "auth_service",
        "GameplayService": "gameplay_service",
        "SessionService": "session_service",
        "TradeService": "trade_service",
        "WantedService": "wanted_service",
        "MonopolyService": "monopoly_service",
        "EventService": "event_service",
        "SettlementService": "settlement_service",
    }
    module_name = service_modules.get(name)
    if not module_name:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module = import_module(f"{__name__}.{module_name}")
    return getattr(module, name)
