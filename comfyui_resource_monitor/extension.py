from comfy_api.v0_0_2 import ComfyExtension

from .nodes import ResourceSnapshotNode
from .routes import register_promptserver_routes

_routes_registered = False


class ResourceMonitorExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[ResourceSnapshotNode]]:
        global _routes_registered
        if not _routes_registered:
            _routes_registered = register_promptserver_routes()
        return [ResourceSnapshotNode]


def comfy_entrypoint() -> ResourceMonitorExtension:
    return ResourceMonitorExtension()
