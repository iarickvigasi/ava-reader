"""Primary book language is derived after source/receipt qualification, never from PDF tags."""

import re
import unicodedata
from collections import Counter
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Literal

from pypdf import PdfReader

from ..contracts.profiles import response_language
from .assembly_state import AssemblyState
from .language_evidence import RUSSIAN_LETTERS, ukrainian_evidence
from .language_route import ENGLISH_HINTS
from .prepared import PreparedPage
from .recognition_contract import RecognitionResponse


def observed_language(text: str) -> Literal["en", "uk"] | None:
    if ukrainian_evidence(text).language == "uk":
        return "uk"
    letters = [char for char in text if char.isalpha()]
    latin = sum("LATIN" in unicodedata.name(char, "") for char in letters)
    words = set(re.findall(r"[A-Za-z]+", text.lower()))
    if len(letters) >= 100 and latin >= len(letters) * 0.8 and len(words & ENGLISH_HINTS) >= 2:
        return "en"
    return None


def primary_language(
    prepared: Sequence[PreparedPage], responses: list[RecognitionResponse]
) -> tuple[Literal["en", "uk"], set[int]]:
    lookup = {value.task_id: value for value in responses}
    votes: Counter[str] = Counter()
    pages: dict[str, set[int]] = {"en": set(), "uk": set()}
    total = 0
    for page in prepared:
        native = " ".join(line.text for line in page.observation.lines)
        recognized = [lookup[t.task_id] for t in page.tasks]
        text = native or " ".join(
            segment.text + " " + " ".join(cell.text for row in segment.cells for cell in row)
            for receipt in recognized
            for segment in receipt.segments
            if segment.kind not in {"furniture", "figure"}
        )
        count = sum(char.isalpha() for char in text)
        total += count
        language = observed_language(text)
        if language is None and recognized and count:
            labels = {response_language(value.language, page.profile_id) for value in recognized}
            if len(labels) == 1:
                language = labels.pop()
                # A model label cannot turn incompatible script into supported prose.
                script = "CYRILLIC" if language == "uk" else "LATIN"
                matching = sum(script in unicodedata.name(c, "") for c in text if c.isalpha())
                if matching < count * 0.8:
                    language = None
        if language is not None:
            votes[language] += count
            pages[language].add(page.observation.number)
    if not total or not votes:
        raise ValueError("Source-supported book language requires review")
    winner, count = votes.most_common(1)[0]
    if count < total * 0.8 or winner not in {"en", "uk"}:
        raise ValueError("Ambiguous primary book language requires review")
    return ("uk" if winner == "uk" else "en"), pages[winner]


def language_metadata(
    source: Path,
    state: AssemblyState,
    prepared: Sequence[PreparedPage],
    responses: list[RecognitionResponse],
) -> list[dict[str, Any]]:
    language, pages = primary_language(prepared, responses)
    evidence = next(
        (
            block["evidence"]
            for block in state.blocks
            if block.get("content") and any(value["page"] in pages for value in block["evidence"])
        ),
        None,
    )
    if not evidence:
        raise ValueError("Accepted language has no qualified source text evidence")
    claims = [
        dict(
            id="metadata-source-language",
            field="language",
            value=language,
            status="accepted",
            scope="work",
            origin="source",
            evidence=evidence,
        )
    ]
    catalog = PdfReader(source).trailer["/Root"].get_object()
    tag = catalog.get("/Lang") if isinstance(catalog, dict) else None
    if isinstance(tag, str) and tag.strip() and len(tag) <= 50:
        claims.append(
            dict(
                id="metadata-pdf-language",
                field="language",
                value=tag,
                status="candidate" if tag.split("-")[0].lower() == language else "conflict",
                scope="work",
                origin="source",
                evidence=evidence,
            )
        )
    # Passage tags affect language-aware reading without changing text or codepoint offsets.
    for block in state.blocks:
        for node in [block, *block.get("cells", [])]:
            content = node.get("content")
            if content is None:
                continue
            text = content["text"]
            known = observed_language(text)
            letters = [c for c in text if c.isalpha()]
            script = "CYRILLIC" if language == "uk" else "LATIN"
            matching = sum(script in unicodedata.name(c, "") for c in letters)
            conflict = language == "uk" and any(c.lower() in RUSSIAN_LETTERS for c in letters)
            content["language"] = known or (
                language if letters and matching >= len(letters) * 0.8 and not conflict else "und"
            )
    return claims
