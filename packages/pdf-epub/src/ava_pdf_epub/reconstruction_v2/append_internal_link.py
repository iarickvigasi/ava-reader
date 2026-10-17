"""Coalesce only strictly overlapping claims for one exact resolved internal destination."""

from typing import Any

from .assembly_state import AssemblyState
from .findings import Finding


def append_internal_link(
    content: dict[str, Any], span: dict[str, Any], state: AssemblyState, block_id: str
) -> None:
    spans = content["spans"]
    new_index = len(spans)
    linked = [(i, s) for i, s in enumerate(spans) if s.get("link")]
    linked.append((new_index, span))
    for _, item in linked:
        start, end = item["start"], item["end"]
        if (
            type(start) is not int
            or type(end) is not int
            or not 0 <= start < end <= len(content["text"])
        ):
            raise ValueError("Source internal link range is outside exact canonical text")
    linked.sort(key=lambda pair: (pair[1]["start"], pair[1]["end"]))
    cluster: list[tuple[int, dict[str, Any]]] = []
    end = 0
    for index, item in linked:
        if cluster and item["start"] >= end:
            if any(i == new_index for i, _ in cluster):
                break
            cluster = []
            end = 0
        cluster.append((index, item))
        end = max(end, item["end"])
    if len(cluster) == 1:
        spans.append(span)
        return
    if any(s.get("link") != span["link"] or s.get("style_id") for _, s in cluster):
        raise ValueError("Conflicting overlapping source internal links require review")
    existing = {i for i, _ in cluster if i != new_index}
    first = min(existing)
    merged = {
        **spans[first],
        "start": min(s["start"] for _, s in cluster),
        "end": max(s["end"] for _, s in cluster),
    }
    content["spans"] = [
        merged if i == first else s for i, s in enumerate(spans) if i == first or i not in existing
    ]
    state.structure_findings.append(
        Finding(
            code="SOURCE_INTERNAL_LINK_CLAIMS_COALESCED",
            severity="information",
            block_id=block_id,
            message="Strictly overlapping source internal-link ranges share one exact resolved "
            "chapter, block and offset; their union retains source text and separate styles.",
        )
    )
