"""Place retained prefix ink in one column without copying text or link occurrences."""

import xml.etree.ElementTree as ET

from ..contracts.blocks import ListItemBlock
from ..contracts.graph_links import TextNode
from .xml import element


class LiteralLabelProjection:
    def __init__(self, node: TextNode, root: ET.Element):
        self.root = root
        self.layout = node.literal_label if isinstance(node, ListItemBlock) else None
        self.prefix: ET.Element | None = None
        self.covering = None
        if self.layout is not None:
            width = self.layout.column_em
            root.set(
                "style", f"display:block;padding-inline-start:{width:g}em;text-indent:-{width:g}em"
            )
            self.covering = next(
                (
                    s.id
                    for s in node.content.spans
                    if s.link and s.start == 0 and s.end > self.layout.prefix_end
                ),
                None,
            )
            if self.covering is None:
                self.prefix = self._prefix(root)

    def _prefix(self, parent: ET.Element) -> ET.Element:
        assert self.layout is not None
        prefix = element(
            "span",
            {
                "data-ava-literal-label": "true",
                "style": f"display:inline-block;width:{self.layout.column_em:g}em;text-indent:0",
            },
        )
        parent.append(prefix)
        return prefix

    def base(self, start: int) -> ET.Element:
        if self.layout and self.covering is None and start < self.layout.prefix_end:
            assert self.prefix is not None
            return self.prefix
        return self.root

    def content_parent(self, start: int, link: str | None, parent: ET.Element) -> ET.Element:
        if self.layout and self.covering is not None and link == self.covering:
            if start < self.layout.prefix_end:
                if self.prefix is None:
                    self.prefix = self._prefix(parent)
                return self.prefix
        return parent
