"""Reject flattened lists, missing cells and incorrect row/column header relationships."""

from typing import TYPE_CHECKING

from .blocks import BlockBase, ListItemBlock, TableBlock
from .common import unique
from .table_coverage import covered_slots, header_covers

if TYPE_CHECKING:
    from .book import CanonicalBookV2


def validate_tables(nodes: dict[str, BlockBase]) -> None:
    for table in (n for n in nodes.values() if isinstance(n, TableBlock)):
        origins = [(c.row, c.column) for c in table.cells]
        if origins != sorted(origins):
            raise ValueError("Table cells must follow row-major order")
        owned: set[tuple[int, int]] = set()
        for cell in table.cells:
            slots = covered_slots(cell, table.row_count, table.column_count)
            if owned & slots:
                raise ValueError("Overlapping table cells")
            owned.update(slots)
        expected = {(r, c) for r in range(table.row_count) for c in range(table.column_count)}
        if owned != expected:
            raise ValueError("Table cells must cover the exact row-major rectangular grid")
        headers = [c for c in table.cells if c.header_axis is not None]
        if not headers:
            raise ValueError("Selected table profile requires header associations")
        for cell in table.cells:
            unique(cell.header_ids, "table header")
            wanted = {
                h.id
                for h in headers
                if h.id != cell.id
                and header_covers(h, cell)
            }
            if set(cell.header_ids) != wanted:
                raise ValueError("Incorrect table header association")


def validate_lists(
    book: "CanonicalBookV2", nodes: dict[str, BlockBase], owners: dict[str, str]
) -> None:
    unique([g.id for g in book.lists], "list group")
    groups = {g.id: g for g in book.lists}
    listed = []
    positions = {b.id: i for i, b in enumerate(book.blocks)}
    for group in book.lists:
        unique(group.item_ids, "list item")
        if group.ordered != (group.start is not None):
            raise ValueError("Ordered lists require a start; unordered lists have none")
        items = [nodes.get(id_) for id_ in group.item_ids]
        if any(not isinstance(n, ListItemBlock) or n.list_id != group.id for n in items):
            raise ValueError("List group membership is inconsistent")
        if len({owners[id_] for id_ in group.item_ids}) != 1:
            raise ValueError("A list group cannot cross logical chapters")
        if [positions[id_] for id_ in group.item_ids] != sorted(
            positions[id_] for id_ in group.item_ids
        ):
            raise ValueError("List items out of canonical order")
        if group.parent_item_id is None:
            if group.depth != 1:
                raise ValueError("Root list depth must be one")
        else:
            parent = nodes.get(group.parent_item_id)
            if not isinstance(parent, ListItemBlock) or parent.list_id not in groups:
                raise ValueError("Nested list requires a real parent item")
            if groups[parent.list_id].depth + 1 != group.depth:
                raise ValueError("Nested list depth does not follow its parent")
            if owners[parent.id] != owners[group.item_ids[0]]:
                raise ValueError("Nested list belongs to another chapter")
            if positions[parent.id] >= positions[group.item_ids[0]]:
                raise ValueError("Parent item must precede nested items")
        listed.extend(group.item_ids)
    actual = [n.id for n in nodes.values() if isinstance(n, ListItemBlock)]
    if len(listed) != len(set(listed)) or set(listed) != set(actual):
        raise ValueError("Every list item must belong to exactly one declared list")

    from .list_order import validate_list_order

    validate_list_order(book)
