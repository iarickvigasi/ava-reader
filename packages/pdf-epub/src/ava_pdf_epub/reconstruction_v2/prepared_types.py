"""Worker-private page versions; historical public page schema stays unchanged."""

from .prepared import PreparedPage
from .prepared_native_layout import NativeLayoutPreparedPage

AnyPreparedPage = PreparedPage | NativeLayoutPreparedPage


def layout_policy(page: AnyPreparedPage) -> str | None:
    return page.source_layout_policy if isinstance(page, NativeLayoutPreparedPage) else None
