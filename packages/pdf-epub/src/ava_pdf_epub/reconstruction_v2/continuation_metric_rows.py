"""Complete literal rows qualify a spacing measurement, never OCR text or link offsets."""

from collections import Counter
from math import isfinite, ulp
from statistics import median

from .native_indent_rows import glyph_key
from .observations import NativeLine, PageObservation
from .ocr_glyph_fragments import Fragment, source_fragments
from .segments import Segment
from .source_gutters import crosses_source_gutter


def metric_stream(fragments: list[Fragment]) -> bool:
    """Whole-row cadence tolerates justified word gaps, without any offset authority."""
    from .geometry import union

    previous = None
    for _, values in fragments:
        ink = [g for _, g in values]
        if any(
            b.box.x0 < a.box.x0 or b.box.x0 - a.box.x1 > min(a.size, b.size)
            for a, b in zip(ink, ink[1:], strict=False)
        ):
            return False
        box = union([g.box for g in ink])
        if previous is not None and (
            box.y0 < previous.y1 or min(box.x1, previous.x1) <= max(box.x0, previous.x0)
        ):
            return False
        previous = box
    return True


def metric_rows(
    page: PageObservation, owner: Segment, owners: list[Segment]
) -> tuple[list[NativeLine], tuple[tuple[str, int], ...]] | None:
    fragments = source_fragments(page, owner)
    if (
        fragments is None
        or len(fragments) < 2
        or not metric_stream(fragments)
        or crosses_source_gutter(page, fragments)
        or len({r.id for r in page.lines}) != len(page.lines)
    ):
        return None
    rows = [line for line, _ in fragments]
    if owner.method == "native" and owner.native_line_ids != [r.id for r in rows]:
        return None
    counts = Counter(glyph_key(g) for r in page.lines for g in r.glyphs if g.text.strip())
    from .geometry import overlap

    for line, values in fragments:
        if [i for i, _ in values] != [i for i, g in enumerate(line.glyphs) if g.text.strip()]:
            return None  # Partial source rows cannot describe a whole paragraph cadence.
        if any(
            counts[glyph_key(g)] != 1
            or any(
                other.id != owner.id and other.page == page.number and overlap(g.box, other.box)
                for other in owners
            )
            for _, g in values
        ):
            return None
    skipped = metric_text_match(owner.text, rows)
    return (rows, skipped) if skipped is not None else None


def metric_text_match(text: str, rows: list[NativeLine]) -> tuple[tuple[str, int], ...] | None:
    """Only literal physical terminal hyphens may be absent; keep their source identities."""
    accepted = "".join(c for c in text if not c.isspace())
    states: dict[int, tuple[tuple[str, int], ...] | None] = {0: ()}
    for index, row in enumerate(rows):
        ink = [(i, g) for i, g in enumerate(row.glyphs) if g.text.strip()]
        literal = "".join(c for _, g in ink for c in g.text if not c.isspace())
        choices: list[tuple[str, tuple[tuple[str, int], ...]]] = [(literal, ())]
        if index + 1 < len(rows) and len(literal) > 1 and ink[-1][1].text == "-":
            following = rows[index + 1].text.lstrip()
            if literal[-2].isalpha() and following[:1].islower():
                choices.append((literal[:-1], ((row.id, ink[-1][0]),)))
        updated: dict[int, tuple[tuple[str, int], ...] | None] = {}
        for cursor, skipped in states.items():
            for value, missing in choices:
                if accepted.startswith(value, cursor):
                    end = cursor + len(value)
                    updated[end] = None if end in updated or skipped is None else skipped + missing
        states = updated
    return states.get(len(accepted))


def cadence(rows: list[NativeLine], size: float) -> tuple[float, tuple[float, ...], float] | None:
    """Check every raw gap before taking a median; no sorting, dropped pairs or clamp."""
    bases = []
    for row in rows:
        ink = [g for g in row.glyphs if g.text.strip()]
        if not ink:
            return None
        levels = [g.box.y1 for g in ink]
        if max(levels) - min(levels) > 8 * max(ulp(v) for v in levels):
            return None  # Interleaved/superscript source rows are not one baseline.
        bases.append(median(levels))
    gaps = tuple((b - a) / size for a, b in zip(bases, bases[1:], strict=False))
    if (
        not gaps
        or any(not isfinite(v) or not 0.5 <= v <= 3 for v in gaps)
        or any(b.box.y0 <= a.box.y0 for a, b in zip(rows, rows[1:], strict=False))
    ):
        return None
    value = median(gaps)
    # Physical PDF coordinate quantization may vary individual rows by <1/1000 em.
    # This only excludes nonuniform cadence. Independent medians must still agree
    # within floating arithmetic error; no model/OCR decimal enters that comparison.
    if max(gaps) - min(gaps) > 0.001:
        return None
    # The median may average two rounded baselines; subtraction adds two
    # coordinate errors. Source glyph size itself comes from a bbox subtraction.
    # Propagate both uncertainties through division, then allow its final rounding.
    # These budgets scale with source-coordinate ULPs, never OCR decimal precision.
    size_error = 4 * max(
        ulp(g.box.y0) + ulp(g.box.y1) for r in rows for g in r.glyphs if g.text.strip()
    )
    if size <= size_error:
        return None
    numerator_error = 4 * max(ulp(v) for v in bases) + max(ulp(v * size) for v in gaps)
    error = (numerator_error + abs(value) * size_error) / (size - size_error) + 4 * ulp(value)
    return value, gaps, error
