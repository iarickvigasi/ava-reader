"""Only qualified contents rows can supply source-addressed printed folio claims."""

import re
from collections.abc import Mapping, Sequence

from .classify_lines import classify_lines
from .furniture import furniture_ids
from .native_contents_rows import native_contents_rows
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_types import AnyPreparedPage, layout_policy
from .segments import Segment
from .structure_claims import StructureClaim


def native_contents_claims(
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    source_line_maps: Mapping[str, NativeLineOffset] | None = None,
) -> list[StructureClaim]:
    if not prepared or layout_policy(prepared[0]) is None:
        return []
    furniture = furniture_ids((p.observation for p in prepared), prepared[0].profile_id)
    result = []
    for page in prepared:
        if not isinstance(page, (NativeLayoutPreparedPage, NativeStructurePreparedPage)):
            raise ValueError("Contents source layout policy changed")
        p = page.observation
        rows, ids = native_contents_rows(p, classify_lines(p, set(), furniture, page.profile_id))
        mappings = source_line_maps
        if mappings is None:
            if isinstance(page, NativeStructurePreparedPage) and ids:
                raise ValueError("Native structure contents require assembled source line maps")
            mappings = {m.line_id: m for m in page.native_line_maps}
        for row in rows:
            if row.id not in ids:
                continue
            title, folio = row.text.rsplit(" ", 1)
            title = re.sub(r"\s*\.{2,}\s*$", "", title)
            owners = [s for s in segments if row.native_line_ids[0] in s.native_line_ids]
            if len(owners) != 1:
                raise ValueError("Qualified contents row has no unique text owner")
            owner = owners[0]
            line = next(line for line in p.lines if line.id == row.native_line_ids[0])
            at = mapped_line_offset(line, owner, mappings)
            if at is None or owner.text[at : at + len(title)] != title:
                raise ValueError("Qualified contents row changed source text or address")
            result.append(StructureClaim(title, owner.id, printed_page=folio, source_offset=at))
    return result
