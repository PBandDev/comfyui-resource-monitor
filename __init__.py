from pathlib import Path
import sys


PACKAGE_ROOT = Path(__file__).resolve().parent
PACKAGE_ROOT_STR = str(PACKAGE_ROOT)
if PACKAGE_ROOT_STR not in sys.path:
    sys.path.insert(0, PACKAGE_ROOT_STR)


def comfy_entrypoint():
    from comfyui_resource_monitor.extension import comfy_entrypoint as extension_entrypoint

    return extension_entrypoint()


WEB_DIRECTORY = "./dist"

__all__ = ["comfy_entrypoint", "WEB_DIRECTORY"]
