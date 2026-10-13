"""One monotone deletion map for styles, callers, targets, aliases and source starts."""


def layout_hyphen_offset(value: int, ranges: list[tuple[int, int]], length: int) -> int:
    if type(value) is not int or not 0 <= value <= length:
        raise ValueError("Layout-hyphen offset outside exact observation")
    previous = 0
    for start, end in ranges:
        if (
            type(start) is not int
            or type(end) is not int
            or not 0 <= previous <= start <= end <= length
        ):
            raise ValueError("Layout-hyphen deletion ranges overlap or are outside observation")
        previous = end
    return value - sum(max(0, min(value, end) - start) for start, end in ranges)


def layout_hyphen_range(
    start: int,
    end: int,
    ranges: list[tuple[int, int]],
    length: int,
    *,
    referenced: bool,
) -> tuple[int, int]:
    if type(start) is not int or type(end) is not int or not 0 <= start < end <= length:
        raise ValueError("Layout-hyphen range outside exact observation")
    first = layout_hyphen_offset(start, ranges, length)
    last = layout_hyphen_offset(end, ranges, length)
    if referenced and first == last:
        raise ValueError("Cannot remove a referenced layout-only range")
    return first, last
