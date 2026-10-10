"""Small printed-credit observations, independent of production source qualification."""

from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import metadata_state, paragraph

CREDIT_STYLE = dict(id="credit", align="center", relative_size=0.8)


def author(rows, value="A. Example"):
    return [
        c
        for c in printed_metadata(metadata_state(rows), value)
        if c.get("contributor_role") == "author"
    ]


def credit(value="A. Example / First edition / 2026-09-28", **extra):
    return paragraph(value, style=CREDIT_STYLE, **extra)
