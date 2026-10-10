"""Corroborate scanned inline marks with independent exact OCR word positions."""

from PIL import Image

from ..contracts.styles import Style
from .annotation_markup import glyph_color
from .annotation_targets import AnnotationTarget, scanned_targets
from .annotation_words import ERROR, AnnotationWord, exact_word_offsets
from .geometry import area, overlap, union
from .observations import PageObservation, RequiredRegion
from .segments import ObservedSpan, Segment


def scanned_marks(
    page: PageObservation,
    segments: list[Segment],
    region: RequiredRegion,
    words: list[AnnotationWord],
    image: Image.Image,
) -> list[tuple[AnnotationTarget, ObservedSpan]]:
    if region.style is None:
        raise ValueError(ERROR)
    lines: dict[tuple[int, int, int], list[AnnotationWord]] = {}
    for word in words:
        lines.setdefault(word.line, []).append(word)
    result = []
    targets = scanned_targets(segments)
    for line in lines.values():
        selected = []
        for ordinal, word in enumerate(line):
            fraction = overlap(word.box, region.box) / area(word.box)
            if fraction <= 0.05:
                continue
            if fraction < 0.9 or word.confidence < 85 or not word.visible:
                raise ValueError(ERROR)
            selected.append(ordinal)
        if not selected:
            continue
        line_box = union([word.box for word in line])
        candidates: dict[int, list[tuple[AnnotationTarget, tuple[int, int]]]] = {
            ordinal: [] for ordinal in selected
        }
        for target in targets:
            if not overlap(target.box, line_box):
                continue
            # A printed OCR line may cross several table cells. Only a cell's
            # fully contained words can qualify its unchanged text and offsets.
            ordinals = (
                [
                    i
                    for i, word in enumerate(line)
                    if overlap(word.box, target.box) / area(word.box) >= 0.9
                ]
                if target.cell is not None
                else list(range(len(line)))
            )
            if not set(ordinals).intersection(selected):
                continue
            try:
                offsets = exact_word_offsets(target.text, [line[i] for i in ordinals])
            except ValueError:
                continue
            for ordinal, offset in zip(ordinals, offsets, strict=True):
                if ordinal in candidates:
                    candidates[ordinal].append((target, offset))
        if any(len(options) != 1 for options in candidates.values()):
            raise ValueError(ERROR)
        previous = None
        for ordinal in selected:
            word = line[ordinal]
            target, (start, end) = candidates[ordinal][0]
            properties = region.style.model_dump(exclude_none=True)
            if region.style.background_color:
                properties["color"] = glyph_color(
                    image, word.box, page.width_pt, page.height_pt, region.style.background_color
                )
            result.append(
                (target, ObservedSpan(start=start, end=end, style=Style.model_validate(properties)))
            )
            if previous is not None and ordinal == previous + 1:
                previous_target, (_, gap_start) = candidates[previous][0]
                gap = target.text[gap_start:start] if previous_target == target else ""
                if gap and gap.isspace():
                    result.append(
                        (target, ObservedSpan(start=gap_start, end=start, style=region.style))
                    )
            previous = ordinal
    if not result:
        raise ValueError(ERROR)
    return result
