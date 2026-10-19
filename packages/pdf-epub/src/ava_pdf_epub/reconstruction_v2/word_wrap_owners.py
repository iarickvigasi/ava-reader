"""Build exact final-owner snapshots from source IDs, regions and typed marker-cut receipts."""

from collections.abc import Mapping, Sequence

from ..contracts.common import unique
from ..contracts.layout_prefix_cut_v3 import PrefixCutReceipt
from ..contracts.source import SourcePage
from .observations import PageObservation
from .segments import Segment
from .word_wrap_component_owners import word_wrap_component_owners
from .word_wrap_owner_source import word_wrap_owner_source
from .word_wrap_regions import word_wrap_regions
from .word_wrap_source_contract import WordWrapOwner


def catalogue_owners(
    segments: Sequence[Segment],
    pages: Sequence[PageObservation],
    source_pages: Sequence[SourcePage],
    cut_receipts: Mapping[str, PrefixCutReceipt],
    language: str,
    *,
    components: Sequence[Segment] | None = None,
    aliases: Mapping[str, tuple[str, int]] | None = None,
) -> list[WordWrapOwner]:
    source = {line.id: (page.number, line) for page in pages for line in page.lines}
    unique([line.id for page in pages for line in page.lines], "word-wrap observed source line")
    regions = word_wrap_regions(pages, source_pages)
    grouped = (
        word_wrap_component_owners(segments, components, aliases or {})
        if components is not None
        else None
    )
    owners: list[WordWrapOwner] = []
    used: set[str] = set()
    for segment in segments:
        if not segment.native_line_ids or not segment.text:
            continue
        if grouped is None and segment.method != "native":
            raise ValueError("Mixed native/recognized word-wrap owners require source components")
        pieces = grouped[segment.id] if grouped is not None else [segment]
        lines, cuts, private = word_wrap_owner_source(pieces, source, regions, cut_receipts, used)
        original = "\n".join(component.original_text for component in private)
        if segment.source_text is None:
            raise ValueError("Word-wrap final native owner lost its literal source text")
        owners.append(
            WordWrapOwner(
                id=segment.id,
                role=segment.kind,
                language=language,
                source_text=segment.source_text,
                original_text=original,
                cuts=cuts,
                lines=lines,
                preserve_line_breaks=segment.preserve_line_breaks,
                components=private if grouped is not None else [],
            )
        )
    if not set(cut_receipts).issubset(used):
        raise ValueError("Word-wrap marker-cut receipt has no final native source owner")
    return owners
