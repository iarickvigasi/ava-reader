"""Recognize deletion of only a layout separator inside a retained hyphenated word."""

import re


def compound_wrap(source: str, start: int, end: int) -> bool:
    return (
        2 <= start < end < len(source)
        and source[start - 1] == "-"
        and source[start - 2].isalpha()
        and source[end].isalpha()
        and re.fullmatch(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", source[start:end]) is not None
    )
