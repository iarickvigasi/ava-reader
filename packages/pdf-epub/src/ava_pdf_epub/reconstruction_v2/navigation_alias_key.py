"""Only witnessed hyphen/en-dash navigation aliases share a comparison identity."""

from .structure_claims import title_key


def navigation_alias_key(text: str) -> str:
    return title_key(text).replace("\u2013", "-")


def dash_alias_offsets(printed: str, bookmark: str) -> list[int]:
    a, b = title_key(printed), title_key(bookmark)
    if len(a) != len(b) or navigation_alias_key(a) != navigation_alias_key(b):
        raise ValueError("Bookmark punctuation differs beyond witnessed dash aliases")
    result = []
    for at, (left, right) in enumerate(zip(a, b, strict=True)):
        if left != right:
            if {left, right} != {"-", "\u2013"}:
                raise ValueError("Bookmark punctuation differs beyond witnessed dash aliases")
            result.append(at)
    return result
