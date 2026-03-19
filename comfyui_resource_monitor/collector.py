from __future__ import annotations

import time
from typing import Any

import psutil

from .schemas import ResourceSnapshot

try:
    import pynvml
except ImportError:  # pragma: no cover - exercised via runtime fallback
    pynvml = None


class ResourceCollector:
    def __init__(self) -> None:
        self._gpu_handle = self._init_gpu_handle()

    def _init_gpu_handle(self) -> Any | None:
        if pynvml is None:
            return None

        try:
            pynvml.nvmlInit()
            if pynvml.nvmlDeviceGetCount() < 1:
                return None
            return pynvml.nvmlDeviceGetHandleByIndex(0)
        except Exception:
            return None

    def get_gpu_payload(self) -> dict[str, Any] | None:
        if self._gpu_handle is None or pynvml is None:
            return None

        try:
            name = pynvml.nvmlDeviceGetName(self._gpu_handle)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(self._gpu_handle)
            memory = pynvml.nvmlDeviceGetMemoryInfo(self._gpu_handle)
            temperature = pynvml.nvmlDeviceGetTemperature(
                self._gpu_handle,
                pynvml.NVML_TEMPERATURE_GPU,
            )
        except Exception:
            return None

        if isinstance(name, bytes):
            name = name.decode("utf-8", errors="replace")

        return {
            "name": str(name),
            "gpu_percent": float(utilization.gpu),
            "vram_percent": (float(memory.used) / float(memory.total)) * 100
            if memory.total
            else 0.0,
            "vram_used_bytes": int(memory.used),
            "vram_total_bytes": int(memory.total),
            "gpu_temp_celsius": float(temperature),
        }

    def normalize_snapshot(
        self,
        timestamp: float,
        cpu_percent: float,
        memory: Any,
        gpu_payload: dict[str, Any] | None,
    ) -> ResourceSnapshot:
        if gpu_payload is None:
            gpu_payload = {
                "name": "",
                "gpu_percent": 0.0,
                "vram_percent": 0.0,
                "vram_used_bytes": 0,
                "vram_total_bytes": 0,
                "gpu_temp_celsius": 0.0,
            }
            gpu_available = False
        else:
            gpu_available = True

        return ResourceSnapshot(
            timestamp=float(timestamp),
            cpu_percent=float(cpu_percent),
            ram_percent=float(memory.percent),
            ram_used_bytes=int(memory.used),
            ram_total_bytes=int(memory.total),
            gpu_available=gpu_available,
            gpu_name=str(gpu_payload["name"]),
            gpu_percent=float(gpu_payload["gpu_percent"]),
            vram_percent=float(gpu_payload["vram_percent"]),
            vram_used_bytes=int(gpu_payload["vram_used_bytes"]),
            vram_total_bytes=int(gpu_payload["vram_total_bytes"]),
            gpu_temp_celsius=float(gpu_payload["gpu_temp_celsius"]),
        )

    def sample(self) -> ResourceSnapshot:
        return self.normalize_snapshot(
            timestamp=time.time(),
            cpu_percent=psutil.cpu_percent(interval=None),
            memory=psutil.virtual_memory(),
            gpu_payload=self.get_gpu_payload(),
        )
