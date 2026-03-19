import asyncio
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

from conftest import install_fake_comfy_api


REPO_ROOT = Path(__file__).resolve().parents[2]
ENTRYPOINT_PATH = REPO_ROOT / "__init__.py"


def load_module_from_path(module_name: str, module_path: Path):
    spec = spec_from_file_location(module_name, module_path)
    assert spec is not None
    assert spec.loader is not None

    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_resource_monitor_entrypoint_exports_expected_symbols():
    module = load_module_from_path("resource_monitor_entrypoint", ENTRYPOINT_PATH)

    assert module.WEB_DIRECTORY == "./dist"
    assert callable(module.comfy_entrypoint)
    assert not hasattr(module, "NODE_CLASS_MAPPINGS")
    assert not hasattr(module, "NODE_DISPLAY_NAME_MAPPINGS")
    assert module.__all__ == ["comfy_entrypoint", "WEB_DIRECTORY"]


def test_resource_monitor_entrypoint_returns_extension_with_snapshot_node(
    monkeypatch,
):
    install_fake_comfy_api(monkeypatch)
    sys.modules.pop("comfyui_resource_monitor.nodes", None)
    sys.modules.pop("comfyui_resource_monitor.extension", None)
    module = load_module_from_path("resource_monitor_entrypoint_safe", ENTRYPOINT_PATH)

    extension = module.comfy_entrypoint()
    node_list = asyncio.run(extension.get_node_list())

    assert extension.__class__.__name__ == "ResourceMonitorExtension"
    assert [node.__name__ for node in node_list] == ["ResourceSnapshotNode"]


def test_resource_monitor_entrypoint_bootstraps_repo_root_for_nested_package(
    monkeypatch,
):
    install_fake_comfy_api(monkeypatch)
    sys.modules.pop("comfyui_resource_monitor", None)
    sys.modules.pop("comfyui_resource_monitor.nodes", None)
    sys.modules.pop("comfyui_resource_monitor.extension", None)
    monkeypatch.setattr(
        sys,
        "path",
        [entry for entry in sys.path if entry != str(REPO_ROOT)],
    )

    module = load_module_from_path("resource_monitor_entrypoint_bootstrap", ENTRYPOINT_PATH)

    extension = module.comfy_entrypoint()

    assert str(REPO_ROOT) in sys.path
    assert extension.__class__.__name__ == "ResourceMonitorExtension"
