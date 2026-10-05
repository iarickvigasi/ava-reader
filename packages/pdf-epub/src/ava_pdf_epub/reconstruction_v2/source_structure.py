"""Corroborate whole-book chapter structure with printed contents/outline and exact openings."""

import re
from collections.abc import Sequence
from pathlib import Path

from .assembly_state import AssemblyState
from .heading_hierarchy import heading_hierarchy
from .prepared import PreparedPage
from .segments import Segment
from .source_folios import source_folios
from .source_references import source_references
from .structure_claims import outline_claims, printed_contents, title_key
from .structure_evidence import structure_findings


def source_structure(
    source: Path,
    prepared: Sequence[PreparedPage],
    qualified: dict[int, list[Segment]],
    segments: list[Segment],
    state: AssemblyState,
) -> list[Segment]:
    folios = source_folios(prepared, qualified)
    state.page_labels = {page: label for label, page in folios.items()}
    folios = {label.casefold(): page for label, page in folios.items()}
    printed = printed_contents(segments)
    claims = [*printed, *outline_claims(source)]
    promoted: dict[str, int] = {}
    ranked: set[str] = set()
    for claim in claims:
        page = (
            claim.pdf_page
            if claim.pdf_page is not None
            else folios.get((claim.printed_page or "").casefold())
        )
        if page is None:
            raise ValueError("Contents page has no unique printed source label")
        matches = [
            s
            for s in segments
            if (s.kind == "heading" or s.structure_candidate)
            and s.page == page
            and title_key(s.text) == title_key(claim.title)
        ]
        if len(matches) != 1:
            raise ValueError("Contents or outline disagrees with a chapter opening")
        target = matches[0]
        depth = claim.depth if claim.depth is not None else (target.heading_level or 1) - 1
        if target.id in promoted and promoted[target.id] != depth:
            raise ValueError("Contents and outline hierarchy disagree")
        promoted[target.id] = depth
        if claim.depth is not None:
            ranked.add(target.id)
        if claim.source_id:
            owner = next(s for s in segments if s.id == claim.source_id)
            at = owner.text.find(claim.title)
            if at < 0:
                raise ValueError("Contents label cannot be aligned with canonical text")
            state.internal_targets.append((owner.id, at, at + len(claim.title), target.id, 0))
    starts = {s.id for s in segments if s.chapter_start}
    if claims and starts and not starts.issubset(promoted):
        raise ValueError("Printed contents or outline omits a detected chapter")
    if not starts and not promoted:
        major = [s for s in segments if s.kind == "heading" and s.heading_level == 1]
        if len({s.page for s in major}) > 1 and any(s.method != "ocr" for s in major):
            raise ValueError("Unnumbered chapter hierarchy requires whole-book source review")
        # OCR ranks already receive blocking source findings below. Let those
        # findings route to whole-book source-crop refinement instead of refusing
        # before the review task can be prepared. No rank is corroborated here.
    result = []
    for segment in segments:
        if segment.id in promoted:
            depth = promoted[segment.id]
            segment = segment.model_copy(
                update={
                    "kind": "heading",
                    "structure_candidate": False,
                    "list_ordered": None,
                    "list_start": None,
                    "list_depth": None,
                    "chapter_start": depth == 0,
                    "heading_level": depth + 1,
                    "chapter_role": "bodymatter" if depth == 0 else None,
                }
            )
        result.append(segment)
    if promoted and not any(s.chapter_start for s in result):
        raise ValueError("Contents hierarchy has no corroborated chapter opening")
    if promoted and result and not result[0].chapter_start:
        first = next(i for i, s in enumerate(result) if s.chapter_start)
        if first > 0 and result[0].kind == "heading" and result[0].page < result[first].page:
            result[0] = result[0].model_copy(
                update={"chapter_start": True, "chapter_role": "frontmatter"}
            )
    deferred_native: set[str] = set()
    result = heading_hierarchy(
        result,
        prepared,
        {key for key, depth in promoted.items() if depth > 0},
        deferred_native,
    )
    # A source-observed notes heading already establishes the numbered entry role;
    # do not ask a second model to reinterpret those entries as chapters.
    notes = False
    resolved = []
    for segment in result:
        if segment.chapter_start:
            notes = False
        if (
            segment.kind == "heading"
            and segment.method == "native"
            and re.fullmatch(
                r"(?:end)?notes?|примітки|кінцеві примітки", segment.text.strip(), re.I
            )
        ):
            notes = True
        if notes and segment.structure_candidate and segment.kind == "list_item":
            segment = segment.model_copy(update={"structure_candidate": False})
        resolved.append(segment)
    result = resolved
    state.structure_findings.extend(structure_findings(result, ranked, deferred_native))
    source_references(result, folios, state)
    return result
