from __future__ import annotations

import sys
import time
from typing import Any

import psutil

from .schemas import ResourceSnapshot

try:
    import pynvml
except ImportError:  # pragma: no cover - exercised via runtime fallback
    pynvml = None

try:
    import wmi
except ImportError:  # pragma: no cover - exercised via runtime fallback
    wmi = None


class WindowsCpuUtilityReader:
    def __init__(self, client: Any) -> None:
        self._client = client
        self._names = ("_Total", "0,_Total")
        self._disabled = False

    def sample_percent(self) -> float | None:
        if self._disabled:
            return None

        try:
            for name in self._names:
                rows = self._client.Win32_PerfFormattedData_Counters_ProcessorInformation(
                    Name=name,
                )
                if not rows:
                    continue

                utility = getattr(rows[0], "PercentProcessorUtility", None)
                if utility is None:
                    continue

                return max(0.0, min(float(utility), 100.0))
        except Exception:
            self._disabled = True
            return None

        return None


class ResourceCollector:
    def __init__(self) -> None:
        self._gpu_handle = self._init_gpu_handle()
        self._prev_cpu_times = psutil.cpu_times()
        self._windows_cpu_reader = self._init_windows_cpu_reader()

    def _init_windows_cpu_reader(self) -> WindowsCpuUtilityReader | None:
        if sys.platform != "win32" or wmi is None:
            return None

        try:
            client = wmi.WMI(namespace="root\\cimv2")
        except Exception:
            return None

        return WindowsCpuUtilityReader(client)

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

    def compute_cpu_percent(self) -> float:
        """Compute CPU% using our own cpu_times() deltas.

        Unlike psutil.cpu_percent(interval=None) which uses module-level
        global state (contaminated if any other code calls it), this tracks
        its own previous sample for accurate delta computation.

        On Windows, prefer Task Manager-aligned Processor Utility when WMI
        telemetry is available. Fall back to cpu_times deltas everywhere else.
        """
        if self._windows_cpu_reader is not None:
            utility_percent = self._windows_cpu_reader.sample_percent()
            if utility_percent is not None:
                return utility_percent

        current = psutil.cpu_times()
        prev = self._prev_cpu_times
        self._prev_cpu_times = current

        prev_busy = prev.user + prev.system
        curr_busy = current.user + current.system

        # Include iowait on Linux (not available on Windows)
        prev_idle = prev.idle + getattr(prev, "iowait", 0)
        curr_idle = current.idle + getattr(current, "iowait", 0)

        total_delta = (curr_busy + curr_idle) - (prev_busy + prev_idle)
        if total_delta <= 0:
            return 0.0

        busy_delta = curr_busy - prev_busy
        return max(0.0, min((busy_delta / total_delta) * 100.0, 100.0))

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
            cpu_percent=self.compute_cpu_percent(),
            memory=psutil.virtual_memory(),
            gpu_payload=self.get_gpu_payload(),
        )
