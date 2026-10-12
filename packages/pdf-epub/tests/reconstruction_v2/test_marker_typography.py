"""Authored source spans cross prefix separation, canonical assembly and portable EPUB."""

import io
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.reader import prepare_reader
from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.marker_typography import marker_typography
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment

from ..epub_v2.helpers import fixture


def source_item(block, marker, ordinal, depth, marker_style=None):
    text = marker + " " + block["content"]["text"]
    box = {**block["evidence"][0]["box"], "coordinate_space": "page_points_top_left"}
    return Segment(
        id=block["id"],
        page=1,
        kind="list_item",
        text=text,
        source_text=text,
        box=box,
        method="native",
        list_ordered=ordinal is not None,
        list_start=ordinal,
        list_depth=depth,
        style=Style(id="body", family="serif", bold=False, italic=False),
        spans=[ObservedSpan(start=0, end=len(marker), style=marker_style)] if marker_style else [],
    )


class MarkerTypography(unittest.TestCase):
    def test_long_marker_scans_twenty_thousand_body_spans_once(self):
        marker = "0" * 120000 + "1."
        for style in (None, Style(id="body-only", color="#1f3763", bold=False)):
            segment = Segment(
                id="large-list-item",
                page=1,
                method="ocr",
                kind="list_item",
                text=marker + " " + "x" * 20000,
                box=dict(
                    coordinate_space="page_points_top_left", x0=0.0, y0=0.0, x1=200.0, y1=200.0
                ),
                list_ordered=True,
                list_start=1,
                list_depth=1,
                spans=[
                    ObservedSpan(start=len(marker) + 1 + i, end=len(marker) + 2 + i, style=style)
                    for i in range(20000)
                ],
            )
            spans = SingleScanSpans(segment.spans)
            instrumented = segment.model_copy(update={"spans": spans})
            with self.subTest(style=style):
                self.assertIsNone(marker_typography(instrumented, len(marker)))
                self.assertEqual(20000, spans.visits)

    def test_long_styled_marker_scans_overlapping_style_spans_once(self):
        marker = "0" * 120000 + "1."
        style = Style(id="source-marker", color="#1f3763", bold=False)
        segment = Segment(
            id="large-list-item",
            page=1,
            method="ocr",
            kind="list_item",
            text=marker + " Body",
            box=dict(coordinate_space="page_points_top_left", x0=0.0, y0=0.0, x1=200.0, y1=200.0),
            list_ordered=True,
            list_start=1,
            list_depth=1,
            spans=[ObservedSpan(start=0, end=len(marker), style=style) for _ in range(20000)],
        )
        spans = SingleScanSpans(segment.spans)
        result = marker_typography(segment.model_copy(update={"spans": spans}), len(marker))
        self.assertEqual(style, result)
        self.assertEqual(20000, spans.visits)

    def test_interval_boundaries_keep_unsorted_coverage_and_reject_gaps(self):
        original, _, _ = fixture()
        raw = next(b for b in original.model_dump()["blocks"] if b["kind"] == "list_item")
        style = Style(id="regular-marker", bold=False)
        source = source_item(raw, "12.", 12, 1).model_copy(
            update={
                "style": Style(id="body", bold=True),
                "spans": [
                    ObservedSpan(start=1, end=3, style=style),
                    ObservedSpan(start=0, end=1, style=style),
                ],
            }
        )
        self.assertFalse(marker_typography(source, 3).bold)
        gap = source.model_copy(
            update={
                "spans": [
                    ObservedSpan(start=2, end=3, style=style),
                    ObservedSpan(start=0, end=1, style=style),
                ]
            }
        )
        with self.assertRaisesRegex(ValueError, "Mixed"):
            marker_typography(gap, 3)

    def test_source_marker_to_canonical_visible_epub_and_reimport(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        items = [b for b in raw["blocks"] if b["kind"] == "list_item"]
        blue = Style(id="blue-marker", color="#1f3763", family="sans-serif", bold=True)
        segments = [
            source_item(items[0], "12.", 12, 1, blue),
            source_item(items[1], "•", None, 2),
            source_item(items[2], "13.", 13, 1),
        ]
        state = AssemblyState(evidence={b["id"]: b["evidence"] for b in items})
        stripped = printed_markers(segments, state)
        state.segments = {s.id: s for s in stripped}
        assemble_blocks(stripped, [], Path("."), state)
        assemble_lists(state, [dict(block_ids=[b["id"] for b in items])])
        for block in raw["blocks"]:
            replacement = next((b for b in state.blocks if b["id"] == block["id"]), None)
            if replacement:
                block.clear()
                block.update(replacement)
        raw["styles"].extend(state.styles.values())
        raw["lists"] = state.lists
        book = CanonicalBookV2.model_validate(raw)
        parent, child, following = [b for b in book.blocks if b.kind == "list_item"]
        marker = next(s for s in book.styles if s.id == parent.marker_style_id)
        self.assertEqual("#1f3763", marker.color)
        self.assertTrue(marker.bold)
        self.assertEqual("sans-serif", marker.family)
        body = next(s for s in book.styles if s.id == parent.style_id)
        self.assertIsNone(body.color)
        self.assertFalse(body.bold)
        self.assertEqual("serif", body.family)
        for old, new in zip(items, [parent, child, following], strict=True):
            self.assertEqual(old["content"]["text"], new.content.text)
            self.assertEqual(old["content"]["sha256"], new.content.sha256)
            self.assertEqual(old["content"]["codepoint_utf16"], new.content.codepoint_utf16)
        self.assertEqual(12, book.lists[0].start)
        self.assertEqual(parent.id, book.lists[1].parent_item_id)
        self.assertEqual(2, book.lists[1].depth)
        self.assertIn(
            "list-marker-styles", prepare_reader(book, "marker-content").required_capabilities
        )
        data = export_epub(book, assets)
        self.assertEqual(data, export_epub(book, assets))
        restored, restored_assets = portable_epub(data)
        self.assertEqual(document_digest(book), document_digest(restored))
        self.assertEqual(book, restored)
        self.assertEqual(assets, restored_assets)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            css = archive.read("EPUB/styles/book.css").decode()
            self.assertIn("::marker{", css)
            self.assertIn("color:#1f3763", css)
            roots = [
                ET.fromstring(archive.read(p))
                for p in archive.namelist()
                if p.startswith("EPUB/text/")
            ]
        node = next(
            n for root in roots for n in root.iter() if n.get("data-ava-block") == parent.id
        )
        self.assertEqual(parent.marker_style_id, node.get("data-ava-marker-style"))
        self.assertEqual(
            parent.content.text, "".join(next(n for n in node if n.get("data-ava-text")).itertext())
        )

    def test_unknown_marker_style_stays_absent_and_body_span_offsets_stay_exact(self):
        original, _, _ = fixture()
        raw = next(b for b in original.model_dump()["blocks"] if b["kind"] == "list_item")
        segment = source_item(raw, "12.", 12, 1).model_copy(update={"style": None})
        segment = segment.model_copy(
            update={
                "spans": [ObservedSpan(start=4, end=9, style=Style(id="body-run", italic=True))],
            }
        )
        state = AssemblyState(internal_targets=[(segment.id, 4, 9, "target", 0)])
        stripped = printed_markers([segment], state)[0]
        state.segments = {stripped.id: stripped}
        state.evidence = {raw["id"]: raw["evidence"]}
        assemble_blocks([stripped], [], Path("."), state)
        self.assertNotIn("marker_style_id", state.blocks[0])
        self.assertEqual((0, 5), (stripped.spans[0].start, stripped.spans[0].end))
        self.assertEqual([(segment.id, 0, 5, "target", 0)], state.internal_targets)

    def test_mixed_marker_glyph_presentation_is_refused_without_guessing(self):
        original, _, _ = fixture()
        raw = next(b for b in original.model_dump()["blocks"] if b["kind"] == "list_item")
        segment = source_item(raw, "12.", 12, 1, Style(id="blue", color="#1f3763"))
        segment = segment.model_copy(
            update={
                "spans": [segment.spans[0].model_copy(update={"end": 1})],
            }
        )
        with self.assertRaisesRegex(ValueError, "marker.*presentation"):
            printed_markers([segment], AssemblyState())

    def test_explicit_regular_marker_overrides_bold_italic_body_without_layout(self):
        original, _, _ = fixture()
        raw = next(b for b in original.model_dump()["blocks"] if b["kind"] == "list_item")
        segment = source_item(
            raw,
            "12.",
            12,
            1,
            Style(
                id="regular-marker",
                bold=False,
                italic=False,
                relative_size=0.8,
            ),
        ).model_copy(
            update={
                "style": Style(
                    id="body",
                    bold=True,
                    italic=True,
                    align="right",
                    relative_size=2.0,
                )
            }
        )
        state = AssemblyState()
        stripped = printed_markers([segment], state)[0]
        marker = Style.model_validate(state.styles[state.marker_presentations[segment.id]])
        self.assertFalse(marker.bold)
        self.assertFalse(marker.italic)
        self.assertEqual(0.8, marker.relative_size)
        self.assertIsNone(marker.align)
        self.assertTrue(stripped.style.bold)
        self.assertEqual(2.0, stripped.style.relative_size)


class SingleScanSpans(list):
    """Count span visits independently of prefix length; a second pass fails immediately."""

    def __init__(self, spans):
        super().__init__(spans)
        self.visits = 0

    def __iter__(self):
        for span in super().__iter__():
            self.visits += 1
            if self.visits > len(self):
                raise AssertionError("Marker capture rescanned the source spans")
            yield span
