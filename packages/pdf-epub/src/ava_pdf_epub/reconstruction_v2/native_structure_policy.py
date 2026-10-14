"""Opt-in source-ID decisions; historical native-layout authority stays unchanged."""

from typing import Literal

NATIVE_STRUCTURE_POLICY = "ava-native-structure-1"
NativeStructurePolicy = Literal["ava-native-structure-1"]
NativeStructurePolicy2 = Literal["ava-native-structure-2"]
AnyNativeStructurePolicy = NativeStructurePolicy | NativeStructurePolicy2


def validate_structure_policy(policy: str | None) -> AnyNativeStructurePolicy | None:
    if policy is None:
        return None
    if policy == "ava-native-structure-2":
        return "ava-native-structure-2"
    if policy != NATIVE_STRUCTURE_POLICY:
        raise ValueError("Unknown native structure policy")
    return "ava-native-structure-1"
