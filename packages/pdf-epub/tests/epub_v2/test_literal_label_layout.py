"""Measured columns preserve text, canonical offsets, links and historical bytes."""

import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.bind_literal_labels import bind_literal_labels

from .helpers import archive_bytes, fixture


def labelled(start=None):
    original, assets, _ = fixture()
    raw = original.model_dump()
    raw["lists"][0]["marker_style"] = "none"
    item = next(b for b in raw["blocks"] if b["id"] == "list-parent")
    item["literal_label"] = dict(prefix_end=6, column_em=4.15)
    if start is not None:
        item["content"]["spans"].append(
            dict(
                id="column-link",
                start=start,
                end=10,
                style_id=None,
                link=dict(kind="external", url="https://example.com/column"),
            )
        )
        address = next(a for a in raw["addresses"] if a["fragment"] == item["id"])
        raw["addresses"].append(
            {**address, "fragment": "column-link", "target": {**address["target"], "offset": start}}
        )
    return raw, assets


class LiteralLabelLayoutTests(unittest.TestCase):
    def test_exact_export_and_enclosing_link_keep_one_occurrence(self):
        for start in (None, 0, 6):
            raw, assets = labelled(start)
            book = CanonicalBookV2.model_validate(raw)
            entries = export_entries(book, assets)
            self.assertEqual(b"ava-epub-canonical-2.6", entries["META-INF/ava-profile"])
            path = next(
                p
                for p, v in entries.items()
                if p.endswith(".xhtml") and b"data-ava-literal-label" in v
            )
            tree = ET.fromstring(entries[path])
            node = next(n for n in tree.iter() if n.get("data-ava-text") == "list-parent")
            self.assertEqual("First recorded task", "".join(node.itertext()))
            prefix = next(n for n in node.iter() if n.get("data-ava-literal-label"))
            self.assertEqual("First ", "".join(prefix.itertext()))
            self.assertIn("width:4.15em", prefix.get("style"))
            self.assertEqual(
                int(start is not None),
                sum(n.get("href") == "https://example.com/column" for n in node.iter()),
            )
            self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))
            broken = {**entries, path: entries[path].replace(b"width:4.15em", b"width:2em")}
            with self.assertRaisesRegex(ValueError, "conservation"):
                portable_epub(archive_bytes(broken))
            with self.assertRaisesRegex(ValueError, "projection"):
                export_epub(book, assets, profile="ava-epub-canonical-2.5")

    def test_partial_link_crossing_is_optional_layout_gap_not_a_split_link(self):
        raw, _ = labelled(2)
        with self.assertRaisesRegex(ValueError, "partially crosses"):
            CanonicalBookV2.model_validate(raw)
        item = next(b for b in raw["blocks"] if b["id"] == "list-parent")
        del item["literal_label"]
        before = item["content"].copy()
        state = AssemblyState(
            blocks=raw["blocks"],
            lists=raw["lists"],
            literal_label_geometry={item["id"]: ("First ", 4.15)},
        )
        bind_literal_labels(state)
        self.assertNotIn("literal_label", item)
        self.assertEqual(before, item["content"])
        self.assertEqual("LITERAL_LABEL_COLUMN_UNPROJECTED", state.structure_findings[0].code)

    def test_absent_layout_and_invalid_range_or_marker_mode(self):
        original, assets, _ = fixture()
        self.assertNotIn("literal_label", original.model_dump_json())
        self.assertEqual(
            export_epub(original, assets),
            export_epub(original, assets, profile="ava-epub-canonical-2.1"),
        )
        raw, _ = labelled()
        raw["lists"][0]["marker_style"] = "decimal"
        with self.assertRaisesRegex(ValueError, "retained text markers"):
            CanonicalBookV2.model_validate(raw)
        raw, _ = labelled()
        next(b for b in raw["blocks"] if b["id"] == "list-parent")["literal_label"][
            "prefix_end"
        ] = 5
        with self.assertRaisesRegex(ValueError, "separator"):
            CanonicalBookV2.model_validate(raw)
