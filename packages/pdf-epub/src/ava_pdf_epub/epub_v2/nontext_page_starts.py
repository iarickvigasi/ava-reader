"""Place nontext page starts beside their exact owned block, never inside table rows."""

import xml.etree.ElementTree as ET

from ..contracts.graph_links import TEXT_NODES
from .context import Context
from .page_marker import page_marker


def add_nontext_page_starts(body: ET.Element, ctx: Context) -> None:
    parents = {child: parent for parent in body.iter() for child in parent}
    by_block: dict[str, list[int]] = {}
    for number, address in ctx.page_starts.items():
        by_block.setdefault(address.target.block_id, []).append(number)
    for node in list(body.iter()):
        ident = node.get("data-ava-block")
        if ident is None or isinstance(ctx.nodes[ident], TEXT_NODES):
            continue
        parent = parents[node]
        index = list(parent).index(node)
        for shift, number in enumerate(sorted(by_block.get(ident, []))):
            parent.insert(index + shift, page_marker(number, ctx))
