"""Versioned instructions are part of source-bound task identity."""

from typing import Literal

RecognitionPromptVersion = Literal[
    "ava-prose-region-2",
    "ava-prose-region-3",
    "ava-prose-region-4",
    "ava-prose-region-5",
    "ava-prose-region-6",
    "ava-prose-region-7",
    "ava-prose-region-8",
    "ava-prose-region-9",
    "ava-prose-region-10",
    "ava-prose-region-11",
    "ava-prose-region-12",
    "ava-prose-region-13",
    "ava-prose-region-14",
    "ava-prose-region-15",
    "ava-prose-region-16",
]

ANCHORED_PROMPT_VERSIONS = frozenset(
    {
        "ava-prose-region-7",
        "ava-prose-region-8",
        "ava-prose-region-9",
        "ava-prose-region-10",
        "ava-prose-region-11",
        "ava-prose-region-12",
        "ava-prose-region-13",
        "ava-prose-region-14",
        "ava-prose-region-15",
        "ava-prose-region-16",
    }
)
PINNED_PROMPT_VERSIONS = frozenset(
    {
        "ava-prose-region-4",
        "ava-prose-region-6",
        "ava-prose-region-8",
        "ava-prose-region-10",
        "ava-prose-region-12",
        "ava-prose-region-14",
        "ava-prose-region-16",
    }
)
