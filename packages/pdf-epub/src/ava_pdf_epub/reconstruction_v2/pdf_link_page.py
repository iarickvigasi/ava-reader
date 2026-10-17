"""Page-local annotation OCR caches live only during one immutable source page."""

from dataclasses import dataclass, field

from .annotation_words import AnnotationWord
from .native_caller_context import ContextCache
from .prepared_types import AnyPreparedPage
from .segments import Segment


@dataclass
class LinkPage:
    checkpoint: AnyPreparedPage
    owners: list[Segment]
    words: list[AnnotationWord] | None = None
    native_words: ContextCache = field(default_factory=dict)
