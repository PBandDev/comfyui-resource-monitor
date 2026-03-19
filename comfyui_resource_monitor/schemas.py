from dataclasses import dataclass


@dataclass(slots=True)
class ResourceSnapshot:
    timestamp: float
    cpu_percent: float
    ram_percent: float
    ram_used_bytes: int
    ram_total_bytes: int
    gpu_available: bool
    gpu_name: str
    gpu_percent: float
    vram_percent: float
    vram_used_bytes: int
    vram_total_bytes: int
    gpu_temp_celsius: float
