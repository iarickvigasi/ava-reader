"""An overlong context and a separate ambiguous context share one correction opportunity."""

from .test_recognition_anchor_context import fixture


def overflow_fixture():
    parent, raw = fixture()
    raw["segments"][0]["spans"][0]["anchor"]["before"] = "x" * 161
    return parent, raw
