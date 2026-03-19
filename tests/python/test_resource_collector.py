import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from comfyui_resource_monitor import collector as collector_module
from comfyui_resource_monitor.collector import ResourceCollector


class DummyMemory:
    total = 16 * 1024 * 1024 * 1024
    used = 8 * 1024 * 1024 * 1024
    percent = 50.0


def test_collector_returns_gpu_fallback_when_gpu_is_unavailable():
    collector = ResourceCollector()

    snapshot = collector.normalize_snapshot(
        timestamp=123.0,
        cpu_percent=12.5,
        memory=DummyMemory(),
        gpu_payload=None,
    )

    assert snapshot.timestamp == 123.0
    assert snapshot.cpu_percent == 12.5
    assert snapshot.ram_percent == 50.0
    assert snapshot.ram_used_bytes == DummyMemory.used
    assert snapshot.ram_total_bytes == DummyMemory.total
    assert snapshot.gpu_available is False
    assert snapshot.gpu_name == ""
    assert snapshot.gpu_percent == 0.0
    assert snapshot.vram_percent == 0.0
    assert snapshot.vram_used_bytes == 0
    assert snapshot.vram_total_bytes == 0
    assert snapshot.gpu_temp_celsius == 0.0


def test_sample_uses_psutil_and_returns_normalized_snapshot(monkeypatch):
    collector = ResourceCollector()

    monkeypatch.setattr(collector_module.time, "time", lambda: 456.0)
    monkeypatch.setattr(collector_module.psutil, "cpu_percent", lambda interval=None: 27.5)
    monkeypatch.setattr(collector_module.psutil, "virtual_memory", lambda: DummyMemory())
    monkeypatch.setattr(collector, "get_gpu_payload", lambda: None)

    snapshot = collector.sample()

    assert snapshot.timestamp == 456.0
    assert snapshot.cpu_percent == 27.5
    assert snapshot.ram_percent == 50.0
    assert snapshot.gpu_available is False
