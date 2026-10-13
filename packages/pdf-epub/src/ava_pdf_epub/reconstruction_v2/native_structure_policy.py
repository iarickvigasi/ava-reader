"""Opt-in source-ID decisions; historical native-layout authority stays unchanged."""

from typing import Literal

NATIVE_STRUCTURE_POLICY = "ava-native-structure-1"
NativeStructurePolicy = Literal["ava-native-structure-1"]


def validate_structure_policy(policy: str | None) -> NativeStructurePolicy | None:
    if policy is None:
        return None
    if policy != NATIVE_STRUCTURE_POLICY:
        raise ValueError("Unknown native structure policy")
    return "ava-native-structure-1"
