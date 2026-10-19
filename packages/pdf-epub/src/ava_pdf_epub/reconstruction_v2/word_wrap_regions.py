"""Source-page authority must cover exactly the immutable observed page geometries."""

from collections.abc import Sequence

from ..contracts.common import unique
from ..contracts.source import SourcePage, SourceRegion
from .observations import PageObservation


def word_wrap_regions(
    pages: Sequence[PageObservation],
    source_pages: Sequence[SourcePage],
) -> dict[int, list[SourceRegion]]:
    unique([str(page.number) for page in pages], "word-wrap observed page")
    unique([str(page.number) for page in source_pages], "word-wrap source page")
    observed = {page.number: page for page in pages}
    if set(observed) != {page.number for page in source_pages}:
        raise ValueError("Word-wrap source-page coverage differs from native observations")
    for supplied in source_pages:
        page = SourcePage.model_validate(supplied.model_dump())
        original = observed[page.number]
        if (page.width_pt, page.height_pt, page.original_rotation) != (
            original.width_pt,
            original.height_pt,
            original.rotation,
        ):
            raise ValueError("Word-wrap source-page geometry differs from native observation")
    return {page.number: page.regions for page in source_pages}
