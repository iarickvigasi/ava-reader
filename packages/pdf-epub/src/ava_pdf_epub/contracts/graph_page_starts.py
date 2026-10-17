"""Validate complete explicit page maps without inferring interior offsets from geometry."""

from typing import TYPE_CHECKING

from .blocks import BlockBase
from .graph_links import TEXT_NODES
from .page_starts import page_addresses, page_fragment

if TYPE_CHECKING:
    from .book import CanonicalBookV2


def validate_page_starts(book: "CanonicalBookV2", nodes: dict[str, BlockBase]) -> None:
    marked = [a for a in book.addresses if a.source_page is not None]
    if not marked:
        return
    starts = page_addresses(book)
    if len(starts) != len(marked):
        raise ValueError("Duplicate physical source-page address")
    first = {
        p.number: next(r.id for r in p.regions if r.role == "content")
        for p in book.pages
        if any(r.role == "content" for r in p.regions)
    }
    if set(starts) != set(first):
        raise ValueError(
            "Source-page map must cover every content page and no blank/furniture page"
        )
    identities = set(nodes) | {c.id for c in book.chapters}
    identities.update(
        s.id for n in nodes.values() if isinstance(n, TEXT_NODES) for s in n.content.spans
    )
    owners: dict[int, BlockBase] = {}
    for block in book.blocks:
        for evidence in block.evidence:
            if first.get(evidence.page) == evidence.region_id:
                owners.setdefault(evidence.page, block)
    for number, address in starts.items():
        if address.fragment != page_fragment(number) or address.fragment in identities:
            raise ValueError("Source-page address has a conflicting reserved identity")
        node = owners.get(number)
        if node is None or address.target.block_id != node.id:
            raise ValueError(
                "Source-page target must own that page's first retained content region"
            )
        offset = address.target.offset
        if isinstance(node, TEXT_NODES):
            if offset >= len(node.content.text):
                raise ValueError("Source-page offset must begin retained canonical text")
            if (node.evidence[0].page == number) != (offset == 0):
                raise ValueError("Source-page offset contradicts the owning block's source start")
        elif offset != 0 or node.evidence[0].page != number:
            raise ValueError("Nontext source-page target must begin its own source block at zero")
