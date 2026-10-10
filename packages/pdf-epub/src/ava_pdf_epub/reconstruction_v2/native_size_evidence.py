"""Retain first-line point sizes and stable multiline prose samples from trusted native sources."""

from collections import Counter, defaultdict
from collections.abc import Sequence
from math import isclose

from .font_style import glyph_size
from .observations import NativeLine
from .prepared import PreparedPage
from .segments import Segment


def native_size_evidence(
    prepared: Sequence[PreparedPage], segments: list[Segment]
) -> tuple[dict[str, float], list[tuple[str, int, float]]]:
    by_page: dict[int, list[Segment]] = defaultdict(list)
    for segment in segments:
        if segment.method == "native":
            by_page[segment.page].append(segment)
    sizes: dict[str, float] = {}
    samples: list[tuple[str, int, float]] = []
    for checkpoint in prepared:
        page = checkpoint.observation
        if set(page.risks) - {"language_uncertain"}:
            continue
        selected = by_page.get(page.number, [])
        owners = Counter(ident for s in selected for ident in s.native_line_ids)
        counts = Counter(line.id for line in page.lines)
        lookup = {line.id: line for line in page.lines}
        for segment in selected:
            ids = segment.native_line_ids
            if (
                not ids
                or not segment.style
                or segment.style.relative_size is None
                or any(owners[i] != 1 or counts[i] != 1 for i in ids)
            ):
                continue
            lines = [lookup[i] for i in ids]
            if not _visible_owned_lines(segment, lines):
                continue
            size = glyph_size(lines[0].glyphs)
            sizes[segment.id] = size
            if _body(segment, lines, size):
                samples.append((segment.id, page.number, size))
    return sizes, samples


def _visible_owned_lines(segment: Segment, lines: list[NativeLine]) -> bool:
    box = segment.box
    return all(
        line.text.strip()
        and line.glyphs
        and any(g.text.strip() for g in line.glyphs)
        and all(
            g.visible
            and line.box.x0 <= g.box.x0 < g.box.x1 <= line.box.x1
            and line.box.y0 <= g.box.y0 < g.box.y1 <= line.box.y1
            for g in line.glyphs
        )
        and box.x0 <= line.box.x0 < line.box.x1 <= box.x1
        and box.y0 <= line.box.y0 < line.box.y1 <= box.y1
        for line in lines
    )


def _body(segment: Segment, lines: list[NativeLine], size: float) -> bool:
    style = segment.style
    return bool(
        segment.kind == "paragraph"
        and not segment.structure_candidate
        and not segment.chapter_start
        and not segment.preserve_line_breaks
        and len(lines) >= 2
        and style
        and style.family in {"serif", "sans-serif"}
        and style.bold is False
        and style.italic is False
        and style.align in {"start", "left", "justify"}
        and all(
            isclose(glyph_size(line.glyphs), size, rel_tol=1e-9, abs_tol=1e-6) for line in lines
        )
    )
