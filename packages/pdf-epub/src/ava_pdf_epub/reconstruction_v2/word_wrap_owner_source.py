"""Project exact native witnesses and protected OCR pieces into full-owner raw positions."""

from collections.abc import Mapping, Sequence

from ..contracts.common import text_digest
from ..contracts.layout_prefix_cut_v3 import LayoutSourceCut, PrefixCutReceipt
from ..contracts.source import SourceRegion
from .observations import NativeLine
from .segments import Segment
from .word_wrap_components import WordWrapSourceComponent
from .word_wrap_source_contract import WordWrapSourceLine


def word_wrap_owner_source(
    pieces: Sequence[Segment],
    source: Mapping[str, tuple[int, NativeLine]],
    regions: Mapping[int, list[SourceRegion]],
    cut_receipts: Mapping[str, PrefixCutReceipt],
    used: set[str],
) -> tuple[list[WordWrapSourceLine], list[LayoutSourceCut], list[WordWrapSourceComponent]]:
    lines, cuts, components, cursor = [], [], [], 0
    for piece in pieces:
        if piece.method not in {"native", "ocr"}:
            raise ValueError("Word-wrap text component has no native/recognized source identity")
        original = []
        if piece.method == "ocr":
            if piece.native_line_ids:
                raise ValueError("Word-wrap recognized source component borrows native lines")
            body = piece.source_text if piece.source_text is not None else piece.text
            original.append(body)
            cursor += len(body) + 1
        else:
            if not piece.native_line_ids or piece.source_text is None:
                raise ValueError("Word-wrap native component lost its literal source identity")
            body = piece.source_text
            for ident in piece.native_line_ids:
                if ident not in source or ident in used:
                    raise ValueError(
                        "Word-wrap final owner has foreign or repeated native source IDs"
                    )
                page_number, observed = source[ident]
                line = _native_witness(observed, page_number, cursor, regions)
                lines.append(line)
                original.append(line.text)
                if ident in cut_receipts:
                    receipt = cut_receipts[ident]
                    cuts.append(
                        LayoutSourceCut(
                            source_start=cursor,
                            source_end=cursor + len(receipt.raw_prefix),
                            receipt=receipt,
                        )
                    )
                used.add(ident)
                cursor = line.source_end + 1
        raw = "\n".join(original)
        components.append(
            WordWrapSourceComponent.model_validate(
                dict(
                    id=piece.id,
                    method=piece.method,
                    original_text=raw,
                    original_sha256=text_digest(raw),
                    source_text=body,
                    source_sha256=text_digest(body),
                    native_line_ids=piece.native_line_ids,
                )
            )
        )
    return lines, cuts, components


def _native_witness(
    line: NativeLine, page: int, cursor: int, regions: Mapping[int, list[SourceRegion]]
) -> WordWrapSourceLine:
    matching = [
        region
        for region in regions.get(page, [])
        if region.role == "content"
        and region.route == "native"
        and region.box.coordinate_space == line.box.coordinate_space == "page_points_top_left"
        and region.box.x0 <= line.box.x0 < line.box.x1 <= region.box.x1
        and region.box.y0 <= line.box.y0 < line.box.y1 <= region.box.y1
    ]
    if len(matching) != 1:
        raise ValueError("Word-wrap source line has no unique native content region")
    return WordWrapSourceLine(
        line_id=line.id,
        page=page,
        region_id=matching[0].id,
        box=line.box,
        text=line.text,
        text_sha256=text_digest(line.text),
        source_start=cursor,
        source_end=cursor + len(line.text),
    )
