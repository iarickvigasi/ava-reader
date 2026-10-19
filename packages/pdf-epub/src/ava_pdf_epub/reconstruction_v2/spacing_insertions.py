"""Only new ASCII spaces may differ; original whitespace and graphemes remain exact."""

import unicodedata


def space_insertions(original: str, proposed: str) -> list[int] | None:
    cursor = 0
    additions: list[int] = []
    for char in proposed:
        if cursor < len(original) and char == original[cursor]:
            cursor += 1
        elif (
            char == " "
            and 0 < cursor < len(original)
            and cursor not in additions
            and _safe(original[cursor - 1])
            and _safe(original[cursor])
        ):
            additions.append(cursor)
        else:
            return None
    return additions if cursor == len(original) else None


def _safe(char: str) -> bool:
    category = unicodedata.category(char)
    return (
        char in "0123456789"
        or category.startswith("P")
        or unicodedata.name(char, "").startswith(("LATIN ", "CYRILLIC "))
    ) and not category.startswith("M")
