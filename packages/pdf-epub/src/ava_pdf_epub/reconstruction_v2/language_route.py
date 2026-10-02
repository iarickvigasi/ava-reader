"""Conservative language-review routing; this heuristic does not certify source language."""

import re
import unicodedata

from ..contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, ProfileId
from .language_evidence import ukrainian_evidence
from .observations import NativeLine

ENGLISH_HINTS = {
    "the",
    "and",
    "with",
    "this",
    "that",
    "from",
    "their",
    "which",
    "where",
    "before",
    "after",
    "these",
    "those",
    "would",
    "should",
    "could",
    "there",
}


def language_uncertain(lines: list[NativeLine], profile_id: ProfileId = LEGACY_PROFILE) -> bool:
    text = " ".join(line.text for line in lines)
    if profile_id == BILINGUAL_PROFILE and ukrainian_evidence(text).language == "uk":
        return False
    letters = [char for char in text if char.isalpha()]
    nonlatin = sum("LATIN" not in unicodedata.name(char, "") for char in letters)
    if len(letters) > 100 and nonlatin / len(letters) > 0.2:
        return True
    words = re.findall(r"[A-Za-z]+", text.lower())
    if len(words) < 40:
        return False
    required = 2 if len(words) > 80 else 1
    return len(set(words) & ENGLISH_HINTS) < required
