"""Keep ambiguous same-font openings separate; geometry selects review, never proves a role."""

import re

from .list_markers import MARKER
from .segments import Segment

LABELS = {
    "preface",
    "foreword",
    "introduction",
    "afterword",
    "conclusion",
    "appendix",
    "acknowledgments",
    "acknowledgements",
    "references",
    "bibliography",
    "notes",
    "contents",
    "table of contents",
    "зміст",
    "передмова",
    "вступ",
    "післямова",
    "висновок",
    "висновки",
    "додаток",
    "додатки",
    "подяки",
    "бібліографія",
    "примітки",
    "затвердження",
}
NUMBERED = re.compile(
    r"^(?:\d{1,3}[.)]\s|[IVXLCDM]{1,8}[.)]?\s|(?:chapter|part|розділ|частина)\b)", re.I
)


def native_structure_candidates(segments: list[Segment]) -> list[Segment]:
    result = []
    for index, segment in enumerate(segments):
        height = max(1, segment.box.y1 - segment.box.y0)
        previous = segments[index - 1] if index else None
        isolated = (
            previous is None
            or segment.box.y0 < previous.box.y0
            or segment.box.y0 - previous.box.y1 >= height * 2
        )
        text = segment.text.strip()
        lexical = text.casefold() in LABELS or bool(NUMBERED.match(text))
        following = segments[index + 1] if index + 1 < len(segments) else None
        compact_list = (
            following is not None
            and MARKER.match(text) is not None
            and MARKER.match(following.text) is not None
            and 0 <= following.box.y0 - segment.box.y1 < height * 2
        )
        candidate = (
            segment.kind == "paragraph"
            and segment.method == "native"
            and (isolated or text.casefold() in LABELS)
            and lexical
            and not compact_list
            and len(text) <= 180
            and len(text.split()) <= 24
            and segment.style is not None
            and segment.style.relative_size is not None
            and segment.style.relative_size >= 0.95
        )
        result.append(
            segment.model_copy(update={"structure_candidate": True}) if candidate else segment
        )
    return result
