"""Anchor source page evidence at its first canonical block, including nested list items."""

import xml.etree.ElementTree as ET

from .context import Context
from .xml import EPUB, XHTML, element


def add_page_anchors(body: ET.Element, ctx: Context, seen: set[int]) -> None:
    parents = {child: parent for parent in body.iter() for child in parent}
    for node in list(body.iter()):
        block_id = node.get("data-ava-block")
        if block_id is None:
            continue
        anchors = []
        for evidence in ctx.nodes[block_id].evidence:
            if evidence.page not in seen:
                anchors.append(
                    element(
                        "span",
                        {
                            "id": f"page-{evidence.page}",
                            f"{{{EPUB}}}type": "pagebreak",
                            "role": "doc-pagebreak",
                            "aria-label": str(evidence.page),
                        },
                    )
                )
                seen.add(evidence.page)
        if node.tag == f"{{{XHTML}}}li":
            for index, anchor in enumerate(anchors):
                node.insert(index, anchor)
        else:
            parent = parents[node]
            index = list(parent).index(node)
            for offset, anchor in enumerate(anchors):
                parent.insert(index + offset, anchor)
