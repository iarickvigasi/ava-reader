"""Global ancestry is checked after every bounded comparison group has returned."""

import re

from .segments import Segment


def validate_refined_graph(segments: list[Segment], parents: dict[str, str | None]) -> None:
    ancestors: dict[int, str] = {}
    numbered_parents: dict[str, tuple[str, int]] = {}
    for segment in segments:
        if segment.kind != "heading":
            continue
        level = segment.heading_level
        if level is None:
            raise ValueError("Heading has no rank")
        if segment.chapter_start:
            if level != 1:
                raise ValueError("Chapter must be level one")
            ancestors.clear()
            numbered_parents.clear()
        expected = ancestors.get(level - 1) if level > 1 else None
        if level > 1 and expected is None:
            raise ValueError("Heading skips an observed parent")
        if segment.id in parents and parents[segment.id] != expected:
            raise ValueError("Refined parent is not the preceding source ancestor")
        # Printed prefixes constrain rank only when their own parent is observed.
        numbered = re.match(r"^(?:[Cc]hapter\s+)?(\d+(?:\.\d+)*)(?:[.):]?\s|$)", segment.text)
        if numbered:
            prefix = numbered[1]
            parent_prefix = prefix.rpartition(".")[0]
            numbered_parent = numbered_parents.get(parent_prefix)
            if numbered_parent and (expected, level - 1) != numbered_parent:
                raise ValueError("Refined rank conflicts with printed numbered parent")
            numbered_parents[prefix] = (segment.id, level)
        ancestors = {rank: ident for rank, ident in ancestors.items() if rank < level}
        ancestors[level] = segment.id
