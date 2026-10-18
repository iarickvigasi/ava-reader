"""Source ordinal and folio slots subtract exactly from complete original line coverage."""

from .ocr_glyph_fragments import Fragment
from .toc_folio_tail import TocFolio


def toc_row_titles(
    body: list[Fragment], folio: TocFolio, label: str, prefix: str, count: int
) -> str:
    titles = []
    for index, (line, selected) in enumerate(body):
        permitted = [i for i, glyph in enumerate(line.glyphs) if glyph.text.strip()]
        if line is folio.line:
            ordinals = [i for i, _ in folio.glyphs]
            if permitted[-len(ordinals) :] != ordinals:
                return ""
            permitted = permitted[: -len(ordinals)]
        if index == 0 and prefix:
            permitted = permitted[count:]
        if [i for i, _ in selected] != permitted:
            return ""
        text = line.text.strip()
        if line is folio.line:
            text = text[: -len(label)].rstrip()
        if index == 0 and prefix and not text.startswith(prefix):
            return ""
        titles.append(text)
    return " ".join(" ".join(titles).split())
