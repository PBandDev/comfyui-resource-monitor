import sys
from collections import namedtuple
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


CpuTimes = namedtuple("CpuTimes", ["user", "system", "idle"])


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


def test_compute_cpu_percent_uses_own_delta():
    """Verify compute_cpu_percent tracks its own cpu_times deltas
    instead of relying on psutil.cpu_percent global state."""
    collector = ResourceCollector()
    collector._windows_cpu_reader = None

    # Simulate: baseline 100s user, 50s system, 850s idle (10% busy at t=0)
    collector._prev_cpu_times = CpuTimes(user=100, system=50, idle=850)

    # After 10s: 105s user (+5), 53s system (+3), 852s idle (+2)
    # Delta: busy=8, idle=2, total=10 -> 80% CPU
    call_count = [0]
    def fake_cpu_times():
        call_count[0] += 1
        return CpuTimes(user=105, system=53, idle=852)

    original = collector_module.psutil.cpu_times
    collector_module.psutil.cpu_times = fake_cpu_times
    try:
        result = collector.compute_cpu_percent()
    finally:
        collector_module.psutil.cpu_times = original

    assert result == 80.0
    assert call_count[0] == 1


def test_compute_cpu_percent_clamps_to_0_100():
    collector = ResourceCollector()
    collector._windows_cpu_reader = None

    # Zero delta -> 0%
    collector._prev_cpu_times = CpuTimes(user=100, system=50, idle=850)

    original = collector_module.psutil.cpu_times
    collector_module.psutil.cpu_times = lambda: CpuTimes(user=100, system=50, idle=850)
    try:
        result = collector.compute_cpu_percent()
    finally:
        collector_module.psutil.cpu_times = original

    assert result == 0.0


def test_compute_cpu_percent_prefers_windows_utility_reader(monkeypatch):
    collector = ResourceCollector()

    class FakeUtilityReader:
        def sample_percent(self):
            return 27.25

    collector._windows_cpu_reader = FakeUtilityReader()
    monkeypatch.setattr(
        collector_module.psutil,
        "cpu_times",
        lambda: (_ for _ in ()).throw(AssertionError("fallback should not run")),
    )

    result = collector.compute_cpu_percent()

    assert result == 27.25


def test_compute_cpu_percent_falls_back_when_windows_utility_reader_has_no_data():
    collector = ResourceCollector()

    class FakeUtilityReader:
        def sample_percent(self):
            return None

    collector._windows_cpu_reader = FakeUtilityReader()
    collector._prev_cpu_times = CpuTimes(user=100, system=50, idle=850)

    original = collector_module.psutil.cpu_times
    collector_module.psutil.cpu_times = lambda: CpuTimes(user=105, system=53, idle=852)
    try:
        result = collector.compute_cpu_percent()
    finally:
        collector_module.psutil.cpu_times = original

    assert result == 80.0


def test_sample_uses_compute_cpu_percent(monkeypatch):
    collector = ResourceCollector()

    monkeypatch.setattr(collector_module.time, "time", lambda: 456.0)
    monkeypatch.setattr(collector, "compute_cpu_percent", lambda: 27.5)
    monkeypatch.setattr(collector_module.psutil, "virtual_memory", lambda: DummyMemory())
    monkeypatch.setattr(collector, "get_gpu_payload", lambda: None)

    snapshot = collector.sample()

    assert snapshot.timestamp == 456.0
    assert snapshot.cpu_percent == 27.5
    assert snapshot.ram_percent == 50.0
    assert snapshot.gpu_available is False
