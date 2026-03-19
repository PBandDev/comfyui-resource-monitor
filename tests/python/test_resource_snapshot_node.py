import sys

from conftest import install_fake_comfy_api


def test_extension_registers_routes_only_once(monkeypatch):
    install_fake_comfy_api(monkeypatch)
    sys.modules.pop("comfyui_resource_monitor.extension", None)
    sys.modules.pop("comfyui_resource_monitor.nodes", None)

    import comfyui_resource_monitor.extension as extension

    registration_calls: list[bool] = []

    def fake_register_promptserver_routes() -> bool:
        registration_calls.append(True)
        return True

    monkeypatch.setattr(
        extension,
        "register_promptserver_routes",
        fake_register_promptserver_routes,
    )

    resource_monitor_extension = extension.ResourceMonitorExtension()

    import asyncio

    first = asyncio.run(resource_monitor_extension.get_node_list())
    second = asyncio.run(resource_monitor_extension.get_node_list())

    assert [node.__name__ for node in first] == ["ResourceSnapshotNode"]
    assert [node.__name__ for node in second] == ["ResourceSnapshotNode"]
    assert registration_calls == [True]


def test_resource_snapshot_node_defines_schema_and_returns_scalars(monkeypatch):
    install_fake_comfy_api(monkeypatch)
    sys.modules.pop("comfyui_resource_monitor.nodes", None)

    from comfyui_resource_monitor.schemas import ResourceSnapshot
    import comfyui_resource_monitor.nodes as nodes

    snapshot = ResourceSnapshot(
        timestamp=123.0,
        cpu_percent=10.5,
        ram_percent=20.5,
        ram_used_bytes=30,
        ram_total_bytes=40,
        gpu_available=False,
        gpu_name="",
        gpu_percent=0.0,
        vram_percent=0.0,
        vram_used_bytes=0,
        vram_total_bytes=0,
        gpu_temp_celsius=0.0,
    )

    class FakeService:
        def __init__(self) -> None:
            self.force_refresh = None

        def get_snapshot(self, force_refresh: bool = False):
            self.force_refresh = force_refresh
            return snapshot

    service = FakeService()
    monkeypatch.setattr(nodes, "get_monitor_service", lambda: service)

    schema = nodes.ResourceSnapshotNode.define_schema()
    result = nodes.ResourceSnapshotNode.execute("workflow_value")

    assert schema.node_id == "ResourceSnapshot"
    assert schema.display_name == "Resource Snapshot"
    assert schema.category == "PBandDev/Resource Monitor"
    assert [(input_.id, input_.optional) for input_ in schema.inputs] == [
        ("passthrough", True),
    ]
    assert [output.name for output in schema.outputs] == [
        "passthrough",
        "cpu_percent",
        "ram_percent",
        "ram_used_bytes",
        "ram_total_bytes",
        "gpu_percent",
        "vram_percent",
        "vram_used_bytes",
        "vram_total_bytes",
        "gpu_temp_celsius",
        "gpu_available",
        "gpu_name",
    ]
    assert result.result == (
        "workflow_value",
        10.5,
        20.5,
        30,
        40,
        0.0,
        0.0,
        0,
        0,
        0.0,
        False,
        "",
    )
    assert service.force_refresh is True
