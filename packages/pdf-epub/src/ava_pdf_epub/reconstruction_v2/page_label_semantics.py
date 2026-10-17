"""Author-declared page labels corroborate a native index reference, never its text."""

from typing import Any

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget, pdf_navigation


def source_destination(reader: PdfReader, annotation: Any, target: NavigationTarget) -> bool:
    if (
        not isinstance(annotation, dict)
        or annotation.get("/Subtype") != "/Link"
        or "/AA" in annotation
    ):
        return False
    action = annotation.get("/A")
    action = action.get_object() if action is not None and hasattr(action, "get_object") else action
    if action is None:
        direct = "/Dest" in annotation
    else:
        direct = (
            isinstance(action, dict)
            and action.get("/S") in {"/GoTo", "/JavaScript"}
            and "/Next" not in action
            and "/Dest" not in annotation
        )
    # The existing parser admits only an exact constant page-jump spelling;
    # JavaScript is never executed or interpreted beyond that fixed grammar.
    return direct and pdf_navigation(reader, annotation) == target


def explicit_decimal_label(reader: PdfReader, target: NavigationTarget) -> str | None:
    if (
        target.url is not None
        or target.page is None
        or target.top is not None
        or target.left is not None
        or not 1 <= target.page <= len(reader.pages)
    ):
        return None
    root = reader.trailer["/Root"]
    if not isinstance(root, dict):
        return None
    tree = root.get("/PageLabels")
    tree = tree.get_object() if tree is not None and hasattr(tree, "get_object") else tree
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
    selected = None
    previous = -1
    for index in range(0, len(numbers), 2):
        start, rule = numbers[index : index + 2]
        if (
            isinstance(start, bool)
            or not isinstance(start, int)
            or not previous < start < len(reader.pages)
        ):
            return None
        previous = start
        if start <= target.page - 1:
            selected = (start, rule.get_object() if hasattr(rule, "get_object") else rule)
    if selected is None:
        return None
    start, rule = selected
    if not isinstance(rule, dict) or rule.get("/S") != "/D" or rule.get("/P", "") != "":
        return None
    initial = rule.get("/St", 1)
    if isinstance(initial, bool) or not isinstance(initial, int) or initial < 1:
        return None
    label = str(initial + target.page - 1 - start)
    try:
        labels = reader.page_labels
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    if labels[target.page - 1] != label or labels.count(label) != 1:
        return None
    return label
