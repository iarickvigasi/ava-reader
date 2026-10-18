"""A special heading slot requires whole source lines, never a convenient substring."""

from .ocr_glyph_fragments import Fragment


def complete_fragment_lines(fragments: list[Fragment]) -> bool:
    return all(
        [i for i, _ in selected] == [i for i, g in enumerate(line.glyphs) if g.text.strip()]
        for line, selected in fragments
    )
