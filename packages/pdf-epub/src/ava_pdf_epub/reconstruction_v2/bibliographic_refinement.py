"""Classify bounded title-page credits without letting a provider invent metadata text."""

from collections.abc import Callable

from ..contracts.common import unique
from .assembly_state import AssemblyState
from .metadata_scope import BIBLIOGRAPHIC_HEADINGS, NON_TITLE_HEADINGS, metadata_scope
from .printed_metadata import PATTERN
from .refinement_contract import BookRefinementResponse, BookRefinementTask
from .segments import Segment


def bibliographic_candidates(segments: list[Segment]) -> list[str]:
    # Reuse bibliographic authority rather than treating every early-page name as a credit.
    state = AssemblyState()
    state.segments = {s.id: s for s in segments}
    state.blocks = [{"id": s.id, "kind": s.kind, "content": {"text": s.text}} for s in segments]
    title, eligible = metadata_scope(state)
    if title is None:
        # OCR cover typography is still awaiting structure refinement. This only
        # schedules a source comparison; final metadata_scope still gates acceptance.
        first_body = next(
            (
                i
                for i, segment in enumerate(segments)
                if segment.chapter_start and segment.chapter_role != "frontmatter"
            ),
            len(segments),
        )
        first = segments[0] if segments else None
        if not (
            first
            and first_body > 0
            and first.method == "ocr"
            and first.page == 1
            and first.kind == "heading"
            and first.heading_level == 1
            and first.chapter_start
            and first.chapter_role == "frontmatter"
            and first.text.strip().casefold() not in NON_TITLE_HEADINGS
            and first.style
            and first.style.align in {"left", "center", "right"}
            and first.style.relative_size is None
        ):
            return []
        title = state.blocks[0]
        eligible = {
            segment.id
            for segment in segments[:first_body]
            if segment.kind in {"heading", "paragraph", "credit"}
        }
    front_end = next(
        (
            i
            for i, segment in enumerate(segments)
            if (segment.kind == "heading" or segment.structure_candidate)
            and segment.text.strip().casefold() in NON_TITLE_HEADINGS - BIBLIOGRAPHIC_HEADINGS
        ),
        len(segments),
    )
    eligible.difference_update(segment.id for segment in segments[front_end:])
    title_page = state.segments[title["id"]].page
    return [
        s.id
        for s in segments
        if s.id in eligible
        and (
            s.kind in {"paragraph", "credit"}
            or (
                s.kind == "heading"
                and s.id != title["id"]
                and not s.chapter_start
                and s.text.strip().casefold() not in NON_TITLE_HEADINGS
            )
        )
        and title_page <= s.page <= title_page + 2
        and not PATTERN.match(s.text)
        and 0 < len(s.text.strip()) <= 200
        and len(s.text.split()) <= 24
    ]


def metadata_crop_groups(ids: list[str], fits: Callable[[list[str]], bool]) -> list[list[str]]:
    pending = [ids[i : i + 24] for i in range(0, len(ids), 24)]
    groups = []
    while pending:
        selected = pending.pop(0)
        if not fits(selected):
            if len(selected) == 1:
                raise ValueError("Bibliographic source crop exceeds supported geometry")
            middle = len(selected) // 2
            pending[:0] = [selected[:middle], selected[middle:]]
        else:
            groups.append(selected)
    return groups


def accept_bibliographic_decisions(
    task: BookRefinementTask, response: BookRefinementResponse
) -> None:
    unique([d.node_id for d in response.metadata_decisions], "bibliographic decisions")
    if {d.node_id for d in response.metadata_decisions} != set(task.metadata_ids):
        raise ValueError("Bibliographic decision coverage differs")
    nodes = {n.id: n for n in task.nodes}
    crops = {c.id: c for c in task.crops}
    for decision in response.metadata_decisions:
        node = nodes[decision.node_id]
        unique(decision.evidence_ids, "bibliographic evidence")
        evidence = [crops.get(ident) for ident in decision.evidence_ids]
        if (
            decision.text_sha256 != node.text_sha256
            or any(c is None for c in evidence)
            or not any(c and c.node_id == node.id and c.part == "head" for c in evidence)
        ):
            raise ValueError("Bibliographic evidence or immutable text identity differs")
        if decision.role is None:
            if decision.start is not None or decision.end is not None:
                raise ValueError("Unknown bibliographic role cannot select metadata text")
        elif (
            decision.start is None
            or decision.end is None
            or not 0 <= decision.start < decision.end <= len(node.text_excerpt)
            or not node.text_excerpt[decision.start : decision.end].strip()
        ):
            raise ValueError("Bibliographic source text range differs")
