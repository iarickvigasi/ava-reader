"""Exact codepoint/UTF-16 boundary maps; never round into a surrogate pair."""


def codepoint_to_utf16(text: str) -> list[int]:
    positions = [0]
    for char in text:
        scalar = ord(char)
        if 0xD800 <= scalar <= 0xDFFF:
            raise ValueError("Unpaired surrogate")
        positions.append(positions[-1] + (2 if scalar > 0xFFFF else 1))
    return positions


def utf16_to_codepoint(text: str, offset: int) -> int:
    if type(offset) is not int:
        raise ValueError("Offset must be an integer")
    boundaries = codepoint_to_utf16(text)
    try:
        return boundaries.index(offset)
    except ValueError:
        raise ValueError("UTF-16 offset is not a text boundary") from None


def codepoint_range_to_utf16(text: str, start: int, end: int) -> tuple[int, int]:
    if type(start) is not int or type(end) is not int or not 0 <= start <= end <= len(text):
        raise ValueError("Range outside canonical text")
    boundaries = codepoint_to_utf16(text)
    return boundaries[start], boundaries[end]
