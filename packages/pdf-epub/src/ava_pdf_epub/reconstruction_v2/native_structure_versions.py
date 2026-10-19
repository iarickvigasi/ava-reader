"""Runtime unions do not widen any historical wire contract."""

from .native_structure_contract import NativeStructureResponse, NativeStructureTask
from .native_structure_v2_contract import NativeStructureResponse2, NativeStructureTask2

AnyNativeStructureTask = NativeStructureTask | NativeStructureTask2
AnyNativeStructureResponse = NativeStructureResponse | NativeStructureResponse2
NATIVE_TASK_TYPES = (NativeStructureTask, NativeStructureTask2)
