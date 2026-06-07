from dataclasses import dataclass


@dataclass(slots=True)
class RandomController:
    seed: int
    encounter_roll: float | None = None
    encounter_index: int | None = None
