"""Advertise sparse physical pairs; only an explicit decision can remove their hyphen."""

from collections.abc import Sequence

from ..contracts.common import text_digest
from ..contracts.layout_hyphen import LayoutHyphenCandidate, LayoutHyphenLine
from ..contracts.profiles import ProfileId
from .classify_lines import classify_lines
from .native_structure_fields import NativeStructureRegion
from .observations import PageObservation


def source_hyphen_candidates(
    page: PageObservation,
    regions: Sequence[NativeStructureRegion],
    source_sha256: str,
    profile_id: ProfileId,
) -> list[LayoutHyphenCandidate]:
    lines = {line.id: line for line in page.lines}
    roles = {s.id: s.kind for s in classify_lines(page, set(), set(), profile_id)}
    candidates = []
    for region in regions:
        if region.artifact_id is not None or region.source.role != "content":
            continue
        for left_id, right_id in zip(region.line_ids, region.line_ids[1:], strict=False):
            left, right = lines[left_id], lines[right_id]
            tail, head = left.text.rstrip(), right.text.lstrip()
            if (
                roles[left_id] != "paragraph"
                or roles[right_id] != "paragraph"
                or len(tail) < 2
                or not tail.endswith("-")
                or not tail[-2].isalpha()
                or not head
                or not head[0].isalpha()
            ):
                continue
            pair = left.text + "\n" + right.text
            split = len(left.text)
            right_start = split + 1
            candidates.append(
                LayoutHyphenCandidate(
                    schema_version="ava-layout-hyphen-candidate-1",
                    id="native-wrap-" + text_digest(source_sha256 + ":" + left_id + ":" + right_id),
                    source_sha256=source_sha256,
                    source_text_sha256=text_digest(pair),
                    source_start=len(tail) - 1,
                    source_end=right_start + len(right.text) - len(head),
                    left=LayoutHyphenLine(
                        line_id=left_id,
                        method="native",
                        page=page.number,
                        region_id=region.source.id,
                        box=left.box,
                        source_start=0,
                        source_end=split,
                    ),
                    right=LayoutHyphenLine(
                        line_id=right_id,
                        method="native",
                        page=page.number,
                        region_id=region.source.id,
                        box=right.box,
                        source_start=right_start,
                        source_end=len(pair),
                    ),
                    role="paragraph",
                    boundary="line",
                    preserve_line_breaks=False,
                    consecutive=True,
                )
            )
    return candidates
