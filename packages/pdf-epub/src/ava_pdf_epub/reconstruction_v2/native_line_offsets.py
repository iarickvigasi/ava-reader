"""Private code-point provenance for grouped source lines; never substring guessing."""

import hashlib
from collections.abc import Mapping

from pydantic import Field

from ..contracts.common import Digest, Record
from .observations import NativeLine, PageObservation
from .segments import Segment


class NativeLineOffset(Record):
    line_id: str = Field(min_length=1, max_length=120)
    segment_id: str = Field(min_length=1, max_length=120)
    start: int = Field(ge=0, le=200000)
    end: int = Field(gt=0, le=200000)
    text_sha256: Digest


def native_line_offsets(
    page: PageObservation, segments: list[Segment], selected: set[str]
) -> list[NativeLineOffset]:
    lines = {line.id: line for line in page.lines}
    if not selected.issubset(lines):
        raise ValueError("Native line map contains a foreign source line")
    output: list[NativeLineOffset] = []
    owners: set[str] = set()
    for segment in segments:
        if not selected.intersection(segment.native_line_ids):
            continue
        if segment.method != "native" or segment.page != page.number:
            raise ValueError("Native line map has an unqualified owner")
        cursor = 0
        for ident in segment.native_line_ids:
            line = lines[ident]
            if ident in owners:
                raise ValueError("Native line has more than one mapped owner")
            # Known joins contribute at most one literal space/newline. Position
            # advances from the prior exact range; repeated text is not searched.
            if not segment.text.startswith(line.text, cursor):
                if cursor and segment.text[cursor : cursor + 1] in {" ", "\n"}:
                    cursor += 1
                if not segment.text.startswith(line.text, cursor):
                    raise ValueError("Native source range does not reproduce its owner")
            end = cursor + len(line.text)
            if end <= cursor:
                raise ValueError("Empty source line cannot supply a mapped text range")
            output.append(
                NativeLineOffset(
                    line_id=ident,
                    segment_id=segment.id,
                    start=cursor,
                    end=end,
                    text_sha256=hashlib.sha256(line.text.encode()).hexdigest(),
                )
            )
            owners.add(ident)
            cursor = end
        if cursor != len(segment.text):
            raise ValueError("Native line map leaves unaccounted owner characters")
    if not selected.issubset(owners):
        raise ValueError("Native line map omitted a source line")
    return output


def mapped_line_offset(
    line: NativeLine, owner: Segment, mappings: Mapping[str, NativeLineOffset] | None
) -> int | None:
    if mappings is None or line.id not in mappings:
        return None
    entry = mappings[line.id]
    if (
        entry.line_id != line.id
        or entry.segment_id != owner.id
        or line.id not in owner.native_line_ids
        or entry.end - entry.start != len(line.text)
        or hashlib.sha256(line.text.encode()).hexdigest() != entry.text_sha256
        or owner.text[entry.start : entry.end] != line.text
    ):
        raise ValueError("Native source line ownership changed")
    return entry.start
