from comfy_api.v0_0_2 import io

from .service import get_monitor_service


class ResourceSnapshotNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="ResourceSnapshot",
            display_name="Resource Snapshot",
            category="PBandDev/Resource Monitor",
            description="Capture the current resource usage as scalar outputs.",
            inputs=[io.AnyType.Input("passthrough", optional=True)],
            outputs=[
                io.AnyType.Output("passthrough"),
                io.Float.Output("cpu_percent"),
                io.Float.Output("ram_percent"),
                io.Int.Output("ram_used_bytes"),
                io.Int.Output("ram_total_bytes"),
                io.Float.Output("gpu_percent"),
                io.Float.Output("vram_percent"),
                io.Int.Output("vram_used_bytes"),
                io.Int.Output("vram_total_bytes"),
                io.Float.Output("gpu_temp_celsius"),
                io.Boolean.Output("gpu_available"),
                io.String.Output("gpu_name"),
            ],
        )

    @classmethod
    def execute(cls, passthrough: object | None = None) -> io.NodeOutput:
        snapshot = get_monitor_service().get_snapshot(force_refresh=True)
        return io.NodeOutput(
            passthrough,
            snapshot.cpu_percent,
            snapshot.ram_percent,
            snapshot.ram_used_bytes,
            snapshot.ram_total_bytes,
            snapshot.gpu_percent,
            snapshot.vram_percent,
            snapshot.vram_used_bytes,
            snapshot.vram_total_bytes,
            snapshot.gpu_temp_celsius,
            snapshot.gpu_available,
            snapshot.gpu_name,
        )
