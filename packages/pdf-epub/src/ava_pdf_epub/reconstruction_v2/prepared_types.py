"""Worker-private page versions; historical public page schema stays unchanged."""

from .prepared import PreparedPage
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_native_word_wrap import NativeWordWrapPreparedPage

AnyPreparedPage = (
    PreparedPage
    | NativeLayoutPreparedPage
    | NativeStructurePreparedPage
    | NativeWordWrapPreparedPage
)


def layout_policy(page: AnyPreparedPage) -> str | None:
    return (
        page.source_layout_policy
        if isinstance(page, (NativeLayoutPreparedPage, NativeStructurePreparedPage))
        else None
    )
