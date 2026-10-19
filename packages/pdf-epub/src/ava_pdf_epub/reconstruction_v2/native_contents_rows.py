"""Source-qualified title/folio rows remain one readable contents stream."""

import re

from .native_layout_qualification import qualified_layout
from .observations import PageObservation
from .paragraphs import _join
from .segments import Segment

FOLIO = re.compile(r"(?:[0-9]{1,4}|[ivxlcdmIVXLCDM]{1,10})")
HEADERS = {"contents", "table of contents", "зміст"}


def split_contents(page: PageObservation, segments: list[Segment]) -> bool:
    return (
        qualified_layout(page)
        and any(
            s.kind == "heading" and " ".join(s.text.split()).casefold() in HEADERS for s in segments
        )
        and any(
            FOLIO.fullmatch(s.text) and s.box.x0 > page.width_pt * 0.65 and s.kind != "furniture"
            for s in segments
        )
    )


def native_contents_rows(
    page: PageObservation, segments: list[Segment]
) -> tuple[list[Segment], set[str]]:
    if not qualified_layout(page) or page.graphics:
        return segments, set()
    headers = [s for s in segments if " ".join(s.text.split()).casefold() in HEADERS]
    if len(headers) != 1 or headers[0].kind != "heading":
        return segments, set()
    header = headers[0]
    content = sorted(
        [s for s in segments if s.box.y0 > header.box.y1 and s.kind != "furniture"],
        key=lambda s: (s.box.y0, s.box.x0),
    )
    if not content or any(
        s.method != "native"
        or len(s.native_line_ids) != 1
        or s.kind not in {"paragraph", "heading"}
        for s in content
    ):
        return segments, set()
    folios = [s for s in content if FOLIO.fullmatch(s.text) and s.box.x0 > page.width_pt * 0.65]
    if len(folios) < 3:
        return segments, set()
    height = max(s.box.y1 - s.box.y0 for s in folios)
    if max(s.box.x1 for s in folios) - min(s.box.x1 for s in folios) > height * 0.2 or any(
        s.box.x1 - s.box.x0 > height * 3 for s in folios
    ):
        return segments, set()
    rows: list[list[Segment]] = []
    used: set[str] = set()
    for folio in folios:
        labels = [
            s
            for s in content
            if s.id != folio.id
            and s.id not in used
            and s.box.x1 < folio.box.x0 - height
            and abs(s.box.y0 - folio.box.y0) <= height * 0.2
            and abs(s.box.y1 - folio.box.y1) <= height * 0.2
        ]
        if len(labels) != 1:
            return segments, set()
        label = labels[0]
        if label.style is None or folio.style is None or label.style.family != folio.style.family:
            return segments, set()
        pending = [
            s
            for s in content
            if s.id not in used
            and s.id not in {folio.id, label.id}
            and s.box.y0 >= (rows[-1][-1].box.y1 if rows else header.box.y1)
            and s.box.y1 < label.box.y0
        ]
        previous = label
        for continuation in reversed(pending):
            if (
                FOLIO.fullmatch(continuation.text)
                or continuation.style is None
                or continuation.style.family != label.style.family
                or abs(continuation.box.x0 - label.box.x0) > height * 0.5
                or not 0 <= previous.box.y0 - continuation.box.y1 <= height * 0.7
                or continuation.box.x1 >= folio.box.x0 - height
            ):
                return segments, set()
            previous = continuation
        row = [*pending, label, folio]
        rows.append(row)
        used.update(s.id for s in row)
    if used != {s.id for s in content}:
        return segments, set()  # An unmatched column, caption or paragraph stays under review.
    replacements = []
    for row in rows:
        item = row[0].model_copy(
            update={
                "kind": "paragraph",
                "heading_level": None,
                "chapter_start": False,
                "chapter_role": None,
                "preserve_line_breaks": True,
            }
        )
        for piece in row[1:]:
            item = _join(item, piece, " ")
        replacements.append(item)
    return [s for s in segments if s.id not in used] + replacements, {s.id for s in replacements}
