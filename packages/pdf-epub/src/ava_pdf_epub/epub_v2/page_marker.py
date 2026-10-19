"""Zero-text physical page identity, with the original printed label when available."""

import xml.etree.ElementTree as ET

from .context import Context
from .xml import EPUB, element


def page_marker(number: int, ctx: Context) -> ET.Element:
    return element(
        "span",
        {
            "id": f"page-{number}",
            f"{{{EPUB}}}type": "pagebreak",
            "role": "doc-pagebreak",
            "aria-label": ctx.page_labels[number],
        },
    )
