import sys
import types
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@dataclass
class FakeSchema:
    node_id: str
    display_name: str
    category: str
    description: str
    inputs: list[object]
    outputs: list[object]


@dataclass
class FakeOutput:
    kind: str
    name: str


@dataclass
class FakeInput:
    kind: str
    id: str
    optional: bool = False


class FakeNodeOutput:
    def __init__(self, *result: object, **_: object) -> None:
        self.result = result


class FakeComfyNode:
    pass


class FakeTypeFactory:
    def __init__(self, kind: str) -> None:
        self.kind = kind

    def Input(self, name: str, optional: bool = False, **_: object) -> FakeInput:
        return FakeInput(kind=self.kind, id=name, optional=optional)

    def Output(self, name: str) -> FakeOutput:
        return FakeOutput(kind=self.kind, name=name)


class FakeComfyExtension:
    async def get_node_list(self) -> list[type[FakeComfyNode]]:
        return []


def install_fake_comfy_api(monkeypatch) -> None:
    comfy_api_module = types.ModuleType("comfy_api")
    v002_module = types.ModuleType("comfy_api.v0_0_2")
    io_namespace = types.SimpleNamespace(
        ComfyNode=FakeComfyNode,
        Schema=FakeSchema,
        NodeOutput=FakeNodeOutput,
        Float=FakeTypeFactory("FLOAT"),
        Int=FakeTypeFactory("INT"),
        Boolean=FakeTypeFactory("BOOLEAN"),
        String=FakeTypeFactory("STRING"),
        AnyType=FakeTypeFactory("*"),
    )

    v002_module.io = io_namespace
    v002_module.ComfyExtension = FakeComfyExtension

    monkeypatch.setitem(sys.modules, "comfy_api", comfy_api_module)
    monkeypatch.setitem(sys.modules, "comfy_api.v0_0_2", v002_module)
