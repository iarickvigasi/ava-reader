"""Resolve complete source titles against adjacent opening fragments, never fuzzy text."""

import re
from collections.abc import Sequence

from .assembly_state import AssemblyState
from .compound_heading_join import join_heading
from .navigation_alias_key import navigation_alias_key
from .segments import Segment
from .structure_claims import StructureClaim


def resolve_heading_claims(
    claims: Sequence[StructureClaim],
    folios: dict[str, int],
    segments: list[Segment],
    state: AssemblyState,
) -> tuple[list[Segment], list[str]]:
    by_page: dict[int, list[int]] = {}
    for index, segment in enumerate(segments):
        if _heading(segment):
            by_page.setdefault(segment.page, []).append(index)
    windows: list[tuple[int, int]] = []
    owners: dict[int, tuple[int, int]] = {}
    for claim in claims:
        page = (
            claim.pdf_page
            if claim.pdf_page is not None
            else folios.get((claim.printed_page or "").casefold())
        )
        if page is None:
            raise ValueError("Contents page has no unique printed source label")
        matches = []
        for start in by_page.get(page, []):
            pieces: list[Segment] = []
            # Bound contiguous candidates; never search arbitrary subsets.
            for end in range(start, min(start + 16, len(segments))):
                item = segments[end]
                if not _heading(item) or item.page != page:
                    break
                if pieces and not _same_stream(pieces[-1], item, state):
                    break
                pieces.append(item)
                text = " ".join(s.text for s in pieces)
                if _matches(claim.title, pieces, text):
                    matches.append((start, end + 1))
                if len(text) > 2000:
                    break
        if len(matches) != 1:
            raise ValueError("Contents or outline disagrees with a chapter opening")
        window = matches[0]
        for index in range(*window):
            if index in owners and owners[index] != window:
                raise ValueError("Contents claims overlap inconsistent heading groups")
            owners[index] = window
        windows.append(window)
    # Resolve every claim before changing owners, so duplicate/overlapping claims
    # cannot accidentally match a group created by a previous claim.
    groups = {start: end for start, end in windows if end > start + 1}
    targets = [segments[start].id for start, _ in windows]
    output, index = [], 0
    while index < len(segments):
        group_end = groups.get(index)
        if group_end is None:
            output.append(segments[index])
            index += 1
        else:
            output.append(join_heading(segments[index:group_end], state))
            index = group_end
    return output, targets


def _heading(segment: Segment) -> bool:
    return bool(segment.text.strip()) and (segment.kind == "heading" or segment.structure_candidate)


def _same_stream(left: Segment, right: Segment, state: AssemblyState) -> bool:
    a, b = state.placements.get(left.id), state.placements.get(right.id)
    if a is None or b is None or left.method != right.method:
        return False
    # In a single-column page each block has its own band. In real columns the
    # band AND column must agree; adjacency alone must not cross a column edge.
    return a[0] == b[0] and ((a[2] == b[2] == 0) or a == b)


def _matches(title: str, pieces: list[Segment], text: str) -> bool:
    key = navigation_alias_key(title)
    if navigation_alias_key(text) == key:
        return True
    # A printed/bookmark label may punctuate an explicit appendix ordinal.
    # The colon is a navigation separator, never inserted into source content.
    if len(pieces) > 1 and re.fullmatch(r"Appendix\s+[0-9]+", pieces[0].text.strip(), re.I):
        punctuated = pieces[0].text.rstrip() + ": " + " ".join(p.text for p in pieces[1:])
        return navigation_alias_key(punctuated) == key
    return False
