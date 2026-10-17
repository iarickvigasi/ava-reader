"""Captured sparse lexical decisions have no authority to rewrite native prose."""

from typing import Literal

NATIVE_WORD_WRAP_POLICY = "ava-native-word-wrap-1"
NativeWordWrapPolicy = Literal["ava-native-word-wrap-1"]


def validate_word_wrap_policy(policy: str | None) -> NativeWordWrapPolicy | None:
    if policy is None:
        return None
    if policy != NATIVE_WORD_WRAP_POLICY:
        raise ValueError("Unknown native word-wrap policy")
    return "ava-native-word-wrap-1"
