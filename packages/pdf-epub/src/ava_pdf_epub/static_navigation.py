"""Interpret a fixed page-jump spelling as data; never execute PDF JavaScript.

Only link actions using this exact literal form can be admitted. Source-bound
reconstruction must still preserve their destinations before producing a candidate.
"""

import re

# A literal page index is the only navigation value. No expressions, comments,
# extra statements, getters, escaped identifiers or general JavaScript parsing.
_PAGE_JUMP = re.compile(
    r"[ \t\r\n]*this[ \t]*\.[ \t]*zoom[ \t]*=[ \t]*100[ \t]*;"
    r"[ \t\r\n]*this[ \t]*\.[ \t]*pageNum[ \t]*=[ \t]*([0-9]{1,3})"
    r"[ \t]*(?:;[ \t]*)?[\r\n]*",
    flags=re.ASCII,
)


def static_page_jump(script: object, page_count: int) -> int:
    """Return a checked zero-based target; reject every other action spelling."""
    if type(page_count) is not int or not 1 <= page_count <= 500:
        raise ValueError("PDF_NAVIGATION_PAGE_COUNT_INVALID")
    if not isinstance(script, str) or len(script) > 256:
        raise ValueError("PDF_NAVIGATION_ACTION_UNSUPPORTED")
    match = _PAGE_JUMP.fullmatch(script)
    if not match or not 0 <= int(match[1]) < page_count:
        raise ValueError("PDF_NAVIGATION_ACTION_UNSUPPORTED")
    return int(match[1])
