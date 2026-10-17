"""Create one original physical pair only inside an already confirmed final native owner."""

from ..contracts.common import text_digest
from ..contracts.layout_hyphen import LayoutHyphenLine
from ..contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2
from .word_wrap_source_contract import WordWrapOwner, WordWrapSourceLine


def word_wrap_candidate(
    owner: WordWrapOwner,
    left: WordWrapSourceLine,
    right: WordWrapSourceLine,
    source_sha256: str,
) -> LayoutHyphenCandidateV2:
    pair, split = left.text + "\n" + right.text, len(left.text)
    right_cut = next((cut for cut in owner.cuts if cut.receipt.line_id == right.line_id), None)
    body_right = right.text[(right_cut.source_end - right_cut.source_start) if right_cut else 0 :]
    tail, head = left.text.rstrip(" \t"), body_right.lstrip(" \t")
    return LayoutHyphenCandidateV2.model_validate(
        dict(
            schema_version="ava-layout-hyphen-candidate-2",
            id="native-wrap-"
            + text_digest(source_sha256 + ":" + left.line_id + ":" + right.line_id),
            source_sha256=source_sha256,
            source_text_sha256=text_digest(pair),
            source_start=len(tail) - 1,
            source_end=split + 1 + len(right.text) - len(head),
            left=_pair_line(left, 0).model_dump(),
            right=_pair_line(right, split + 1).model_dump(),
            role=owner.role,
            boundary=_boundary(left, right),
            preserve_line_breaks=False,
            consecutive=True,
        )
    )


def _pair_line(line: WordWrapSourceLine, start: int) -> LayoutHyphenLine:
    return LayoutHyphenLine(
        line_id=line.line_id,
        method="native",
        page=line.page,
        region_id=line.region_id,
        box=line.box,
        source_start=start,
        source_end=start + len(line.text),
    )


def _boundary(left: WordWrapSourceLine, right: WordWrapSourceLine) -> str:
    if right.page != left.page:
        return "page"
    return "line" if left.region_id == right.region_id else "column"
