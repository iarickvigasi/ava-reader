"""Explicit current request authority; absent policy preserves historical routing."""

from typing import Literal

NATIVE_LAYOUT_POLICY = "ava-native-layout-1"
NativeLayoutPolicy = Literal["ava-native-layout-1"]


def validate_layout_policy(policy: str | None) -> NativeLayoutPolicy | None:
    if policy is None:
        return None
    if policy != NATIVE_LAYOUT_POLICY:
        raise ValueError("Unknown native layout policy")
    return "ava-native-layout-1"
