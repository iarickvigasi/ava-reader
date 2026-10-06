"""Use a unique repeated native prose reference, never page composition, for block font ratios."""

from collections import defaultdict
from collections.abc import Sequence
from statistics import median

from .assembly_state import AssemblyState
from .findings import Finding
from .native_size_evidence import native_size_evidence
from .prepared import PreparedPage
from .segments import Segment


def normalize_native_sizes(
    segments: list[Segment], prepared: Sequence[PreparedPage], state: AssemblyState
) -> list[Segment]:
    if not any(
        s.method == "native" and s.style and s.style.relative_size is not None for s in segments
    ):
        return segments
    sizes, samples = native_size_evidence(prepared, segments)
    cohorts: dict[float, list[tuple[str, int, float]]] = defaultdict(list)
    for sample in samples:
        if sample[0] not in state.bibliographic_roles:
            cohorts[round(sample[2], 6)].append(sample)
    qualified = [rows for rows in cohorts.values() if len({row[1] for row in rows}) >= 2]
    if len(qualified) != 1:
        state.structure_findings.append(
            Finding(
                code="NATIVE_DOCUMENT_SIZE_REFERENCE_UNKNOWN",
                severity="information",
                message="No unique repeated native multiline body-size reference; "
                "local ratios retained.",
            )
        )
        return segments
    rows = qualified[0]
    reference = median(row[2] for row in rows)
    result = []
    changed = 0
    for segment in segments:
        size = sizes.get(segment.id)
        if size is None or segment.style is None:
            result.append(segment)
            continue
        ratio = size / reference
        if not 0.5 <= ratio <= 3:
            state.structure_findings.append(
                Finding(
                    code="NATIVE_DOCUMENT_SIZE_OUT_OF_PROFILE",
                    severity="information",
                    page=segment.page,
                    block_id=segment.id,
                    box=segment.box,
                    message="Source size against the body reference exceeds style limits; "
                    "the existing local ratio is retained without clamping.",
                )
            )
            result.append(segment)
            continue
        if ratio != segment.style.relative_size:
            segment = segment.model_copy(
                update={"style": segment.style.model_copy(update={"relative_size": ratio})}
            )
            changed += 1
        result.append(segment)
    if changed:
        state.structure_findings.append(
            Finding(
                code="NATIVE_DOCUMENT_SIZE_REFERENCE",
                severity="information",
                message=f"{len(rows)} stable native multiline paragraphs across "
                f"{len({r[1] for r in rows})} pages establish {reference:g}pt body size; "
                f"{changed} block ratios rebased from retained first-line glyph sizes. "
                "Inline ratios and source content remain unchanged.",
            )
        )
    return result
