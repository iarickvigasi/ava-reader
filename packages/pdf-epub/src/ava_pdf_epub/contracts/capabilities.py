"""Capabilities derive from actual content, never a caller's optimistic claim."""

from .blocks import FigureBlock, ListItemBlock, NoteBlock, ProseBlock, TableBlock
from .book import CanonicalBookV2
from .graph_index import index_book
from .graph_links import TEXT_NODES
from .page_starts import SOURCE_PAGE_CAPABILITY, page_addresses


def required_capabilities(book: CanonicalBookV2) -> set[str]:
    result = {"text"}
    if page_addresses(book):
        result.add(SOURCE_PAGE_CAPABILITY)
    nodes, _ = index_book(book)
    referenced = {n.style_id for n in nodes.values() if n.style_id}
    referenced.update(
        s.style_id
        for n in nodes.values()
        if isinstance(n, TEXT_NODES)
        for s in n.content.spans
        if s.style_id
    )
    if any(
        s.id in referenced
        and any(
            getattr(s, key) is not None
            for key in (
                "color",
                "background_color",
                "decoration_color",
                "underline",
                "strike_through",
            )
        )
        for s in book.styles
    ):
        result.add("annotation-styles")
    if any(n.style_id is not None for n in nodes.values()):
        result.add("styles")
    for node in nodes.values():
        if isinstance(node, TEXT_NODES):
            if node.content.language is not None:
                result.add("language")
            if any(s.style_id is not None for s in node.content.spans):
                result.add("styles")
            if any(s.link is not None for s in node.content.spans):
                result.add("links")
        if isinstance(node, NoteBlock):
            result.add("notes")
        if isinstance(node, FigureBlock):
            result.add("figures")
        if isinstance(node, TableBlock):
            result.add("tables")
        if isinstance(node, ListItemBlock):
            result.add("lists")
        if isinstance(node, ProseBlock) and node.kind in {"code", "verse"}:
            result.add("literal-text")
    return result
