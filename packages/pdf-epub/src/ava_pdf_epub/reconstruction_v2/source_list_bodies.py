"""Verify a narrow direct-page MCID namespace; unknown structured source stays unqualified."""

from typing import Any

from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, NumberObject


def source_list_bodies(page: Any, reader: PdfReader) -> set[int]:
    namespace = page.get("/StructParents")
    if not isinstance(namespace, NumberObject) or not 0 <= int(namespace) <= 1000000:
        return set()
    document = reader.trailer["/Root"].get_object()
    if not isinstance(document, DictionaryObject):
        return set()
    root = document.get("/StructTreeRoot")
    if root is None:
        return set()
    root = root.get_object()
    if not isinstance(root, DictionaryObject) or root.get("/Type") != "/StructTreeRoot":
        return set()
    tree = root.get("/ParentTree")
    if tree is None:
        return set()
    tree = tree.get_object()
    # Do not infer an association through unknown/nested number-tree layouts.
    if not isinstance(tree, DictionaryObject) or "/Kids" in tree:
        return set()
    nums = tree.get("/Nums")
    if not isinstance(nums, ArrayObject) or len(nums) % 2 or len(nums) > 1000:
        return set()
    keys = nums[::2]
    if any(not isinstance(k, NumberObject) for k in keys) or len(set(keys)) != len(keys):
        return set()
    selected = [nums[i + 1] for i in range(0, len(nums), 2) if nums[i] == namespace]
    if len(selected) != 1:
        return set()
    entries = selected[0].get_object()
    if not isinstance(entries, ArrayObject) or len(entries) > 10000:
        return set()
    result = set()
    for mcid, ref in enumerate(entries):
        element = ref.get_object()
        if not isinstance(element, DictionaryObject) or (
            element.get("/Type") != "/StructElem"
            or element.get("/S") != "/LBody"
            or element.get("/Pg") != page.indirect_reference
        ):
            continue
        children = element.get("/K")
        if isinstance(children, ArrayObject) and len(children) == 1:
            children = children[0]
        if isinstance(children, NumberObject) and int(children) == mcid:
            result.add(mcid)
    return result
