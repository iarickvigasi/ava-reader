"""Full title windows extend only through the immediate independently proved source subtitle."""

from .complete_fragment_lines import complete_fragment_lines
from .geometry import union
from .navigation_alias_key import navigation_alias_key
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment, source_fragments
from .ocr_glyph_map import prove_glyph_map
from .segments import Segment


def heading_title_window(
    page: PageObservation,
    owner: Segment,
    owners: list[Segment],
    fragments: list[Fragment],
    title: str,
    policy: str | None,
) -> set[str]:
    positions = {line.id: i for i, line in enumerate(page.lines)}
    indices = [positions[line.id] for line, _ in fragments]
    if indices != list(range(indices[0], indices[-1] + 1)):
        return set()
    keys = {navigation_alias_key(title)}
    at = next(i for i, item in enumerate(owners) if item is owner)
    if at + 1 < len(owners):
        subtitle = owners[at + 1]
        extra = source_fragments(page, subtitle) if subtitle.page == page.number else None
        if (
            subtitle.kind == "heading"
            and subtitle.heading_level == 2
            and not subtitle.chapter_start
            and extra
            and complete_fragment_lines(extra)
            and positions[extra[0][0].id] == indices[-1] + 1
            and [positions[line.id] for line, _ in extra]
            == list(range(positions[extra[0][0].id], positions[extra[-1][0].id] + 1))
            and prove_glyph_map(page, subtitle, owners, policy) is not None
        ):
            body = union([g.box for _, values in fragments[1:] for _, g in values])
            first = union([g.box for _, g in extra[0][1]])
            last = union([g.box for _, g in fragments[-1][1]])
            size = max(g.size for _, values in fragments for _, g in values)
            if body.x0 <= first.x0 and first.x1 <= body.x1 and 0 <= first.y0 - last.y1 <= 2 * size:
                keys.add(
                    navigation_alias_key(title + " " + " ".join(line.text for line, _ in extra))
                )
    return keys
