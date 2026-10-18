"""Explicit finite decimal/Roman labels for corroborated TOC actions, including XYZ views."""

import re
from typing import Any

from pypdf import PdfReader


def toc_page_label(reader: PdfReader, page: int) -> str | None:
    if isinstance(page, bool) or not isinstance(page, int) or not 1 <= page <= len(reader.pages):
        return None
    catalog = reader.trailer["/Root"]
    if not isinstance(catalog, dict):
        return None
    tree: Any = catalog.get("/PageLabels")
    tree = tree.get_object() if hasattr(tree, "get_object") else tree
    if not isinstance(tree, dict) or "/Kids" in tree:
        return None
    numbers = tree.get("/Nums")
    if (
        not isinstance(numbers, list)
        or not numbers
        or len(numbers) % 2
        or numbers[0] != 0
        or len(numbers) > 2 * len(reader.pages)
    ):
        return None
    selected, previous = None, -1
    for offset in range(0, len(numbers), 2):
        start, rule = numbers[offset : offset + 2]
        if (
            isinstance(start, bool)
            or not isinstance(start, int)
            or not previous < start < len(reader.pages)
        ):
            return None
        previous = start
        if start <= page - 1:
            selected = (start, rule.get_object() if hasattr(rule, "get_object") else rule)
    if selected is None:
        return None
    start, rule = selected
    if not isinstance(rule, dict) or rule.get("/P", "") != "":
        return None
    initial, style = rule.get("/St", 1), rule.get("/S")
    if isinstance(initial, bool) or not isinstance(initial, int) or initial < 1:
        return None
    number = initial + page - 1 - start
    if (
        not isinstance(style, str)
        or style not in {"/D", "/r", "/R"}
        or number > (9999 if style == "/D" else 3999)
    ):
        return None
    try:
        labels = reader.page_labels
        label = labels[page - 1]
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    if labels.count(label) != 1:
        return None
    if style == "/D":
        return label if label == str(number) else None
    if label != (label.lower() if style == "/r" else label.upper()):
        return None
    upper = label.upper()
    if not upper or not re.fullmatch(
        r"M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})", upper
    ):
        return None
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = sum(
        -values[c] if i + 1 < len(upper) and values[c] < values[upper[i + 1]] else values[c]
        for i, c in enumerate(upper)
    )
    return label if total == number else None
