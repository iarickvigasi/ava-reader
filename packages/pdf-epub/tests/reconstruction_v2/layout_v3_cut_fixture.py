"""Exact authored note/list prefix receipts preserve the whole physical source line."""

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.layout_prefix_cut_v3 import LayoutSourceCut, PrefixCutReceipt


def authored_cuts(witnesses, left, right, prefixes, role):
    cuts = []
    for index, raw in prefixes:
        line = witnesses[index]
        receipt = PrefixCutReceipt(
            line_id=line.line_id,
            raw_prefix=raw,
            raw_prefix_sha256=text_digest(raw),
            original_line_sha256=text_digest(left if index == 0 else right),
            role=role,
            label=raw.strip().strip("[]()."),
            marker_text=raw.strip(),
        )
        cuts.append(
            LayoutSourceCut(
                source_start=line.source_start,
                source_end=line.source_start + len(raw),
                receipt=receipt,
            )
        )
    return cuts
