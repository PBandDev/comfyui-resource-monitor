import asyncio
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from comfyui_resource_monitor.schemas import ResourceSnapshot
from comfyui_resource_monitor.routes import build_route_handlers
from comfyui_resource_monitor import service as service_module
from comfyui_resource_monitor.service import ResourceMonitorService


class FakeCollector:
    def __init__(self) -> None:
        self.calls = 0

    def sample(self) -> ResourceSnapshot:
        self.calls += 1
        return ResourceSnapshot(
            timestamp=float(self.calls),
            cpu_percent=10.0,
            ram_percent=20.0,
            ram_used_bytes=3,
            ram_total_bytes=4,
            gpu_available=False,
            gpu_name="",
            gpu_percent=0.0,
            vram_percent=0.0,
            vram_used_bytes=0,
            vram_total_bytes=0,
            gpu_temp_celsius=0.0,
        )


def test_service_reuses_last_snapshot_when_requested():
    collector = FakeCollector()
    service = ResourceMonitorService(collector=collector)

    first = service.get_snapshot(force_refresh=True)
    second = service.get_snapshot(force_refresh=False)

    assert first is second
    assert collector.calls == 1


def test_service_publishes_latest_snapshot_when_sender_is_available():
    collector = FakeCollector()
    sent_messages: list[tuple[str, dict[str, object], str | None]] = []

    async def fake_sender(
        event_name: str,
        payload: dict[str, object],
        client_id: str | None,
    ) -> None:
        sent_messages.append((event_name, payload, client_id))

    service = ResourceMonitorService(collector=collector, prompt_sender=fake_sender)
    snapshot = service.get_snapshot(force_refresh=True)
    service.register_client("client-123", 1.0)

    asyncio.run(service.publish_snapshot(snapshot))

    assert sent_messages == [
        (
            "resource-monitor.snapshot",
            {
                "timestamp": snapshot.timestamp,
                "cpu_percent": snapshot.cpu_percent,
                "ram_percent": snapshot.ram_percent,
                "ram_used_bytes": snapshot.ram_used_bytes,
                "ram_total_bytes": snapshot.ram_total_bytes,
                "gpu_available": snapshot.gpu_available,
                "gpu_name": snapshot.gpu_name,
                "gpu_percent": snapshot.gpu_percent,
                "vram_percent": snapshot.vram_percent,
                "vram_used_bytes": snapshot.vram_used_bytes,
                "vram_total_bytes": snapshot.vram_total_bytes,
                "gpu_temp_celsius": snapshot.gpu_temp_celsius,
            },
            "client-123",
        )
    ]


def test_service_publishes_to_all_active_clients():
    collector = FakeCollector()
    sent_messages: list[tuple[str, dict[str, object], str | None]] = []

    async def fake_sender(
        event_name: str,
        payload: dict[str, object],
        client_id: str | None,
    ) -> None:
        sent_messages.append((event_name, payload, client_id))

    service = ResourceMonitorService(collector=collector, prompt_sender=fake_sender)
    service.register_client("client-123", 1.0)
    service.register_client("client-456", 0.5)

    asyncio.run(service.publish_snapshot())

    assert [message[2] for message in sent_messages] == ["client-123", "client-456"]


def test_service_prunes_inactive_clients_and_restores_default_refresh_interval(monkeypatch):
    collector = FakeCollector()
    service = ResourceMonitorService(
        collector=collector,
        refresh_interval=2.0,
        client_timeout=5.0,
    )
    monotonic_values = iter([10.0, 12.0, 20.5, 20.5])

    monkeypatch.setattr(service_module.time, "monotonic", lambda: next(monotonic_values))

    assert service.register_client("client-123", 0.5) is True
    assert service.register_client("client-456", 1.0) is True
    assert service.refresh_interval == 0.5

    active_clients = service.get_active_client_ids()

    assert active_clients == ()
    assert service.refresh_interval == 2.0


def test_routes_module_imports_without_comfy_server_present():
    import comfyui_resource_monitor.routes as routes

    assert hasattr(routes, "build_route_handlers")


def test_service_start_is_safe_without_a_running_event_loop():
    service = ResourceMonitorService(collector=FakeCollector())

    started = service.start()

    assert started is False
    assert service._task is None


def test_configure_route_ignores_invalid_refresh_interval():
    class FakeRequest:
        async def json(self) -> dict[str, object]:
            return {
                "refresh_interval": "not-a-number",
                "force_refresh": False,
                "client_id": "client-123",
            }

    service = ResourceMonitorService(collector=FakeCollector(), refresh_interval=2.5)
    handlers = build_route_handlers(service)

    payload = asyncio.run(handlers["configure"](FakeRequest()))

    assert payload["refresh_interval"] == 2.5
    assert payload["active_clients"] == 1
    assert payload["snapshot"]["timestamp"] == 1.0


def test_configure_route_starts_service_and_returns_bootstrap_snapshot():
    class FakeRequest:
        async def json(self) -> dict[str, object]:
            return {
                "refresh_interval": 0.5,
                "force_refresh": True,
                "client_id": "client-abc",
            }

    service = ResourceMonitorService(collector=FakeCollector(), refresh_interval=2.5)
    handlers = build_route_handlers(service)
    start_calls: list[float] = []

    def fake_start() -> bool:
        start_calls.append(service.refresh_interval)
        return True

    service.start = fake_start  # type: ignore[method-assign]

    payload = asyncio.run(handlers["configure"](FakeRequest()))

    assert payload["active_clients"] == 1
    assert payload["started"] is True
    assert payload["refresh_interval"] == 0.5
    assert payload["snapshot"]["timestamp"] == 1.0
    assert start_calls == [0.5]


def test_configure_route_tracks_active_clients():
    class FakeRequest:
        async def json(self) -> dict[str, object]:
            return {
                "refresh_interval": 0.5,
                "force_refresh": False,
                "client_id": "client-abc",
            }

    service = ResourceMonitorService(collector=FakeCollector())
    handlers = build_route_handlers(service)

    asyncio.run(handlers["configure"](FakeRequest()))

    assert service.get_active_client_ids() == ("client-abc",)


def test_disconnect_route_unregisters_the_client():
    class FakeRequest:
        def __init__(self, payload: dict[str, object]) -> None:
            self._payload = payload

        async def json(self) -> dict[str, object]:
            return self._payload

    service = ResourceMonitorService(collector=FakeCollector())
    handlers = build_route_handlers(service)

    asyncio.run(
        handlers["configure"](
            FakeRequest(
                {
                    "refresh_interval": 0.5,
                    "force_refresh": False,
                    "client_id": "client-abc",
                }
            )
        )
    )
    payload = asyncio.run(
        handlers["disconnect"](FakeRequest({"client_id": "client-abc"}))
    )

    assert payload == {
        "active_clients": 0,
        "disconnected": True,
    }
    assert service.get_active_client_ids() == ()
