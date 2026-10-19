"""A closed index-furniture proof shares unchanged physical and literal glyph guards."""

from statistics import median

from .geometry import union
from .index_header_types import IndexHeaderWitness
from .index_layout import TITLE, index_rows
from .native_line_visibility import complete_visible_line
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .source_glyph_map import source_glyph_map

MARGIN_FRACTION = 0.08
LARGE_TITLE_RATIO = 1.35
GEOMETRY_DIGITS = 4


def index_header_witness(
    checkpoint: AnyPreparedPage, owner: Segment, owners: list[Segment]
) -> IndexHeaderWitness | None:
    page = checkpoint.observation
    if (
        owner.kind not in {"heading", "furniture"}
        or owner.chapter_start
        or owner.chapter_role
        or owner.source_marginal_furniture
        or not TITLE.fullmatch(owner.text)
        or any(
            s.url is not None or s.note_label is not None or s.target_text is not None
            for s in owner.spans
        )
    ):
        return None
    # Furniture peers enter only this closed gate; generic owner eligibility is unchanged.
    proof = source_glyph_map(page, owner, owners)
    if proof is None or not proof.glyphs:
        return None
    ids = {g.line_id for g in proof.glyphs}
    lines = [line for line in page.lines if line.id in ids]
    if len(lines) != 1 or lines[0].text != owner.text:
        return None
    line = lines[0]
    ink = [g for g in line.glyphs if g.text.strip()]
    if len(proof.glyphs) != len(ink) or any(not g.font for g in ink):
        return None
    physical = union([g.box for g in ink])
    if physical.y1 > page.height_pt * MARGIN_FRACTION:
        return None
    rows = index_rows(page)
    if not rows or any(not complete_visible_line(row) for row in rows):
        return None
    body = [g for row in rows for g in row.glyphs if g.text.strip()]
    if not body or any(g.source_artifact or not g.visible or g.size <= 0 for g in body):
        return None
    if max(g.size for g in ink) >= median(g.size for g in body) * LARGE_TITLE_RATIO:
        return None
    key = (
        checkpoint.source_sha256,
        owner.text,
        page.number % 2,
        round(page.width_pt, GEOMETRY_DIGITS),
        round(page.height_pt, GEOMETRY_DIGITS),
        tuple(
            round(v, GEOMETRY_DIGITS) for v in (physical.x0, physical.y0, physical.x1, physical.y1)
        ),
        tuple((g.font, g.size) for g in ink),
    )
    return IndexHeaderWitness(owner, key)
