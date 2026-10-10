"""Private annotation-free rendering must never authorize concealed source words."""

from collections import Counter
from dataclasses import replace

from PIL import Image

from .annotation_words import ERROR, AnnotationWord
from .observations import PageObservation


def source_visible_words(
    page: PageObservation,
    words: list[AnnotationWord],
    original: Image.Image,
    clean: Image.Image,
) -> list[AnnotationWord]:
    """Require original pixels to retain at least half the independently observed ink.

    Thin inline decorations may cross letters; opaque plates must not reveal
    underlying prose merely because the private PDF excluded a markup object.
    Confidence/exact text/geometry checks remain separate requirements.
    """
    if original.mode != "RGB" or clean.mode != "RGB" or original.size != clean.size:
        raise ValueError(ERROR)
    result = []
    for word in words:
        box = word.box
        x0, y0, x1, y1 = (
            max(0, int(box.x0 / page.width_pt * original.width)),
            max(0, int(box.y0 / page.height_pt * original.height)),
            min(original.width, int(box.x1 / page.width_pt * original.width + 0.5)),
            min(original.height, int(box.y1 / page.height_pt * original.height + 0.5)),
        )
        bounds = (x0, y0, x1, y1)
        surrounding = clean.crop(
            (max(0, x0 - 2), max(0, y0 - 2), min(clean.width, x1 + 2), min(clean.height, y1 + 2))
        )
        pixels = surrounding.tobytes()
        width, height = surrounding.size
        border = Counter(
            tuple(pixels[3 * (y * width + x) : 3 * (y * width + x) + 3])
            for y in range(height)
            for x in (
                range(width)
                if y < 2 or y >= height - 2 or width <= 4
                else (*range(2), *range(width - 2, width))
            )
        )
        background = border.most_common(1)[0][0] if border else (255, 255, 255)
        before, after = clean.crop(bounds).tobytes(), original.crop(bounds).tobytes()
        ink = visible = 0
        for offset in range(0, len(before), 3):
            color = before[offset : offset + 3]
            if max(abs(color[channel] - background[channel]) for channel in range(3)) < 60:
                continue
            ink += 1
            if max(abs(color[channel] - after[offset + channel]) for channel in range(3)) <= 30:
                visible += 1
        result.append(replace(word, visible=ink >= 3 and visible >= ink * 0.5))
    return result
