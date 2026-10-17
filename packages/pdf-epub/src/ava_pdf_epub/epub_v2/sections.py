"""Partition publication files at accepted major headings, never source page boundaries."""

from bisect import bisect_right
from dataclasses import dataclass

from ..contracts.blocks import FigureBlock, HeadingBlock, TableBlock
from ..contracts.book import CanonicalBookV2
from ..contracts.structure import TocEntry


@dataclass(frozen=True)
class PublicationPart:
    chapter_id: str
    opening_id: str
    title: str
    block_ids: list[str]


def major_sections(book: CanonicalBookV2) -> dict[str, set[str]]:
    """Only direct H2 children of one accepted H1 chapter root qualify."""
    nodes = {b.id: b for b in book.blocks}
    positions = {b.id: i for i, b in enumerate(book.blocks)}
    roots: dict[str, list[TocEntry]] = {}
    for entry in book.toc:
        node = nodes.get(entry.target.block_id)
        if (
            entry.parent_id is None
            and entry.target.offset == 0
            and isinstance(node, HeadingBlock)
            and node.level == 1
        ):
            roots.setdefault(entry.target.chapter_id, []).append(entry)
    qualified = {items[0].id: items[0] for items in roots.values() if len(items) == 1}
    candidates: dict[str, set[str]] = {}
    for entry in book.toc:
        root = qualified.get(entry.parent_id or "")
        node = nodes.get(entry.target.block_id)
        if (
            root is not None
            and entry.target.chapter_id == root.target.chapter_id
            and entry.target.offset == 0
            and isinstance(node, HeadingBlock)
            and node.level == 2
            and positions[node.id] > positions[root.target.block_id]
        ):
            candidates.setdefault(entry.target.chapter_id, set()).add(node.id)
    # Descriptions are DOM-local ID references. A heading cannot cut their source
    # unit into different files; retain the original block order and whole unit.
    intervals = []
    for node in book.blocks:
        related = (
            [node.caption_id, node.credit_id]
            if isinstance(node, FigureBlock)
            else [node.caption_id]
            if isinstance(node, TableBlock)
            else []
        )
        for id_ in related:
            if id_ is not None:
                low, high = sorted([positions[node.id], positions[id_]])
                intervals.append((low + 1, high))
    merged: list[tuple[int, int]] = []
    for low, high in sorted(intervals):
        if merged and low <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(high, merged[-1][1]))
        else:
            merged.append((low, high))
    lower = [low for low, _ in merged]

    def intact(id_: str) -> bool:
        position = positions[id_]
        index = bisect_right(lower, position) - 1
        return index < 0 or position > merged[index][1]

    return {
        chapter: {key for key in starts if intact(key)} for chapter, starts in candidates.items()
    }


def publication_parts(book: CanonicalBookV2, *, split_sections: bool) -> list[PublicationPart]:
    output = []
    nodes = {b.id: b for b in book.blocks}
    major = major_sections(book) if split_sections else {}
    for chapter in book.chapters:
        starts = major.get(chapter.id, set())
        boundaries = [0, *[i for i, id_ in enumerate(chapter.block_ids) if id_ in starts]]
        for index, start in enumerate(boundaries):
            end = boundaries[index + 1] if index + 1 < len(boundaries) else len(chapter.block_ids)
            ids = chapter.block_ids[start:end]
            opening = nodes[ids[0]]
            title = (
                opening.content.text
                if start and isinstance(opening, HeadingBlock)
                else chapter.title
            )
            output.append(PublicationPart(chapter.id, ids[0], title, ids))
    return output
