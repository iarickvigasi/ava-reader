"""Build one bounded canonical identity index for graph validators."""

from typing import TYPE_CHECKING

from .blocks import BlockBase, TableBlock
from .common import unique

if TYPE_CHECKING:
    from .book import CanonicalBookV2


def index_book(book: "CanonicalBookV2") -> tuple[dict[str, BlockBase], dict[str, str]]:
    total = len(book.blocks) + sum(len(b.cells) for b in book.blocks if isinstance(b, TableBlock))
    if total > 20000:
        raise ValueError("Aggregate block/cell bound exceeded")
    nodes: list[BlockBase] = []
    for b in book.blocks:
        nodes.append(b)
        if isinstance(b, TableBlock):
            nodes.extend(b.cells)
    unique([n.id for n in nodes], "block/cell ID")
    index = {n.id: n for n in nodes}
    unique([c.id for c in book.chapters], "chapter ID")
    if book.spine != [c.id for c in book.chapters]:
        raise ValueError("Spine must cover every chapter once in declared order")
    declared = [id_ for c in book.chapters for id_ in c.block_ids]
    if declared != [b.id for b in book.blocks]:
        raise ValueError("Chapter membership must conserve exact canonical block order")
    owner = {b: c.id for c in book.chapters for b in c.block_ids}
    for b in book.blocks:
        if isinstance(b, TableBlock):
            owner.update({cell.id: owner[b.id] for cell in b.cells})
    unique([path for c in book.chapters for path in c.resource_paths], "chapter resource")
    if any(not path.endswith(".xhtml") for c in book.chapters for path in c.resource_paths):
        raise ValueError("Chapter resource must be XHTML")
    return index, owner
