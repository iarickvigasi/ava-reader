"""Routing evidence only: never an accepted language claim or a text normalization pass."""

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

UKRAINIAN_HINTS = frozenset(
    "що щоб якщо але вже коли для про його вона вони було дуже від тому між які "
    "цей ця це або може тільки перед після більше також ніж мене мені".split()
)
UKRAINIAN_LETTERS = frozenset("іїєґ")
RUSSIAN_LETTERS = frozenset("ыэъё")


@dataclass(frozen=True)
class LanguageEvidence:
    language: Literal["uk"] | None
    letters: int
    cyrillic_letters: int
    distinctive_letters: int
    distinct_letter_kinds: int
    hint_kinds: int
    conflicting_letters: int


def ukrainian_evidence(text: str) -> LanguageEvidence:
    # Case folding is a private comparison, never a replacement of source characters/offsets.
    letters = [char for char in text if char.isalpha()]
    cyrillic = sum("CYRILLIC" in unicodedata.name(char, "") for char in letters)
    folded = [char.casefold() for char in letters]
    distinctive = sum(char in UKRAINIAN_LETTERS for char in folded)
    kinds = len(set(folded) & UKRAINIAN_LETTERS)
    conflicts = sum(char in RUSSIAN_LETTERS for char in folded)
    words = set(re.findall(r"[^\W\d_]+", text.casefold()))
    hints = len(words & UKRAINIAN_HINTS)
    supported = (
        len(letters) >= 100
        and cyrillic >= len(letters) * 0.8
        and distinctive >= 3
        and kinds >= 2
        and hints >= 3
        and conflicts == 0
    )
    return LanguageEvidence(
        language="uk" if supported else None,
        letters=len(letters),
        cyrillic_letters=cyrillic,
        distinctive_letters=distinctive,
        distinct_letter_kinds=kinds,
        hint_kinds=hints,
        conflicting_letters=conflicts,
    )
