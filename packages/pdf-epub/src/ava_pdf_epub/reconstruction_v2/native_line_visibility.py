"""Every observed glyph must account for the complete source line in order."""

from .observations import NativeLine


def complete_visible_line(line: NativeLine) -> bool:
    cursor = 0
    for glyph in line.glyphs:
        at = line.text.find(glyph.text, cursor)
        if (
            at < cursor
            or line.text[cursor:at].strip()
            or (glyph.text.strip() and not glyph.visible)
        ):
            return False
        cursor = at + len(glyph.text)
    return not line.text[cursor:].strip()
