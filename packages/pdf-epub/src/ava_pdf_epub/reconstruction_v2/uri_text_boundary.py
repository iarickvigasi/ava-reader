"""A literal URI cannot borrow a prefix or suffix from a longer visible address."""


def uri_boundary_before(text: str, start: int) -> bool:
    return start == 0 or text[start - 1].isspace() or text[start - 1] in "([{<\"'“‘"


def uri_boundary_after(text: str, end: int) -> bool:
    if end == len(text) or text[end].isspace():
        return True
    if text[end] in ")]}>\"'”’":
        return True
    cursor = end
    while cursor < len(text) and text[cursor] in ".,;:!?":
        cursor += 1
    return cursor > end and (
        cursor == len(text) or text[cursor].isspace() or text[cursor] in ")]}>\"'”’"
    )
