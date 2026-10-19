"""Positive index layout selects review; it never certifies text or entry ownership."""

import re

from .observations import NativeLine, PageObservation

INDEX_LAYOUT_RISK = "native_index_layout"
MIN_ENTRIES = 6
MIN_ENTRY_FRACTION = 0.6
MIN_COLUMN_PAIRS = 3
TITLE = re.compile(
    r"(?:[0-9]{1,4}\s+)?(?:general index|subject index|name index|index|"
    r"предметний покажчик|іменний покажчик|покажчик)(?:\s+[0-9]{1,4})?",
    re.I,
)
FOLIO = r"[0-9]{1,4}(?:[–-][0-9]{1,4})?"
ENTRY_END = re.compile(
    rf"\s(?:{FOLIO}(?:\s*[,;]\s*{FOLIO})*(?:\s+passim)?|"
    r"(?:see(?: also)?|див\.?)\s+\S.*)[.,;]?$",
    re.I,
)


def index_layout(page: PageObservation) -> bool:
    return bool(index_rows(page))


def index_rows(page: PageObservation) -> list[NativeLine]:
    headers = [
        line
        for line in page.lines
        if line.box.y0 < page.height_pt / 4 and TITLE.fullmatch(" ".join(line.text.split()))
    ]
    if len(headers) != 1:
        return []
    rows = [line for line in page.lines if line.box.y0 > headers[0].box.y1]
    entries = [
        line for line in rows if any(c.isalpha() for c in line.text) and ENTRY_END.search(line.text)
    ]
    if len(entries) < MIN_ENTRIES or len(entries) < len(rows) * MIN_ENTRY_FRACTION:
        return []
    left = [line for line in entries if line.box.x1 < page.width_pt / 2]
    right = [line for line in entries if line.box.x0 > page.width_pt / 2]
    pairs = sum(
        any(
            abs(a.box.y1 - b.box.y1) <= min(a.box.y1 - a.box.y0, b.box.y1 - b.box.y0) / 4
            for b in right
        )
        for a in left
    )
    return entries if pairs >= MIN_COLUMN_PAIRS else []


def mark_index_layout(page: PageObservation) -> PageObservation:
    if INDEX_LAYOUT_RISK in page.risks or not index_layout(page):
        return page
    return page.model_copy(update={"risks": [*page.risks, INDEX_LAYOUT_RISK]})
