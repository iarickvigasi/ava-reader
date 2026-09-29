"""A nested list belongs immediately after its parent, before its parent's next sibling."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .book import CanonicalBookV2
    from .structure import ListGroup


def validate_list_order(book: "CanonicalBookV2") -> None:
    positions = {b.id: i for i, b in enumerate(book.blocks)}
    children: dict[str, list[ListGroup]] = {}
    for group in book.lists:
        if group.parent_item_id is not None:
            children.setdefault(group.parent_item_id, []).append(group)
    for groups in children.values():
        groups.sort(key=lambda group: positions[group.item_ids[0]])

    def walk(group: "ListGroup") -> list[str]:
        output = []
        for item in group.item_ids:
            output.append(item)
            for child in children.get(item, []):
                output.extend(walk(child))
        return output

    actual = [b.id for b in book.blocks]
    for group in book.lists:
        if group.parent_item_id is None:
            expected = walk(group)
            start = positions[expected[0]]
            if actual[start : start + len(expected)] != expected:
                raise ValueError(
                    "Nested list order must preserve parent/child and sibling boundaries"
                )
