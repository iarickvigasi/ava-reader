"""Exact characters, anchors, styles and historical exports survive script projection."""

import hashlib
import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.offsets import codepoint_to_utf16
from ava_pdf_epub.epub_v2.context import Context, ident
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.inline import render_text
from ava_pdf_epub.epub_v2.intrinsic_script import intrinsic_family
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.profiles import export_profile
from tests.reconstruction_v2.page_start_test_fixture import joined_book

from .helpers import archive_bytes, fixture
from .test_source_page_starts import marker_offsets


def script_book():
    book, assets, _ = fixture()
    raw = book.model_dump()
    block = next(b for b in raw["blocks"] if b["id"] == "style-demo")
    text = block["content"]["text"]
    text = text[:25] + "₂" + text[26:29] + "²2₃ⁱ³\u0301⁴\ufe0f⁵\u200d⁶😀" + text[30:]
    spans = block["content"]["spans"]
    spans[-1]["end"] = 41
    spans.append(
        dict(
            id="script-link",
            start=29,
            end=41,
            link=dict(kind="external", url="https://example.org/script"),
        )
    )
    content = dict(
        text=text,
        sha256=hashlib.sha256(text.encode()).hexdigest(),
        codepoint_utf16=codepoint_to_utf16(text),
    )
    content["spans"] = spans
    block["content"] = content
    address = next(a for a in raw["addresses"] if a["fragment"] == "style-super")
    raw["addresses"].append({**address, "fragment": "script-link"})
    style = next(s for s in raw["styles"] if s["id"] == "super")
    style.update(relative_size=0.7, bold=True, color="#aa0000", underline=True)
    return CanonicalBookV2.model_validate(raw), assets


def fragment(book, enabled=True):
    ctx = Context(book, intrinsic_scripts=enabled)
    node = ctx.nodes["style-demo"]
    return node, render_text(node, ctx)


class IntrinsicScriptTests(unittest.TestCase):
    def test_same_family_only_and_complex_sequences_untouched(self):
        for family, digits in [("super", "⁰¹²³⁴⁵⁶⁷⁸⁹"), ("sub", "₀₁₂₃₄₅₆₇₈₉")]:
            self.assertEqual([family] * 10, [intrinsic_family(digits, i) for i in range(10)])
        for text, offset in [
            ("ⁱ", 0),
            ("1", 0),
            ("²\u0301", 0),
            ("²\U000e0100", 0),
            ("²\u200d³", 2),
        ]:
            self.assertIsNone(intrinsic_family(text, offset))

    def test_mixed_link_keeps_exact_offsets_and_other_styles(self):
        book, assets = script_book()
        before = book.model_dump_json()
        node, tree = fragment(book)
        self.assertEqual(node.content.text, "".join(tree.itertext()))
        projected = [n for n in tree.iter() if n.get("style") == "vertical-align:baseline"]
        self.assertEqual(["₂", "²"], ["".join(n.itertext()) for n in projected])
        self.assertEqual(1, sum(n.get("href") == "https://example.org/script" for n in tree.iter()))
        old_ids = {n.get("id") for n in fragment(book, False)[1].iter() if n.get("id")}
        self.assertEqual(old_ids, {n.get("id") for n in tree.iter() if n.get("id")})
        entries = export_entries(book, assets)
        self.assertEqual(b"ava-epub-canonical-2.7", entries["META-INF/ava-profile"])
        self.assertIn(b"font-size:0.7em", entries["EPUB/styles/book.css"])
        self.assertIn(b"color:#aa0000", entries["EPUB/styles/book.css"])
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))
        for profile in ["2.1", "2.2", "2.4", "2.5", "2.6"]:
            legacy = export_epub(book, assets, profile="ava-epub-canonical-" + profile)
            self.assertEqual((book, assets), portable_epub(legacy))
        self.assertEqual(before, book.model_dump_json())
        path = next(
            p
            for p, v in entries.items()
            if p.endswith(".xhtml") and b"vertical-align:baseline" in v
        )
        changed = {
            **entries,
            path: entries[path].replace(b"vertical-align:baseline", b"vertical-align:super"),
        }
        with self.assertRaisesRegex(ValueError, "conservation"):
            portable_epub(archive_bytes(changed))

    def test_nested_matching_placements_suppressed_but_conflicts_retained(self):
        book, _ = script_book()
        node, _ = fragment(book)
        span = next(s for s in node.content.spans if s.id == "style-super")
        nested = span.model_copy(update={"id": "nested"})
        node.content.spans.append(nested)
        ctx = Context(book, intrinsic_scripts=True)
        tree = render_text(node, ctx)
        self.assertEqual(3, sum(n.get("style") == "vertical-align:baseline" for n in tree.iter()))
        for style in ["sub", "normal-reset"]:
            node.content.spans[-1] = nested.model_copy(update={"style_id": style})
            ctx.styles[style] = ctx.styles[style].model_copy(
                update={"vertical_align": "sub" if style == "sub" else "baseline"}
            )
            tree = render_text(node, ctx)
            self.assertEqual(
                ["₂"],
                [
                    "".join(n.itertext())
                    for n in tree.iter()
                    if n.get("style") == "vertical-align:baseline"
                ],
            )
        self.assertIn(ident("s", "style-super"), ET.tostring(tree, encoding="unicode"))

    def test_source_pages_and_utf16_coordinates_survive_new_splits(self):
        book, _, _, _ = joined_book(["A😀¹", "² continues", "and ends."])
        raw = book.model_dump()
        block = raw["blocks"][0]
        text = block["content"]["text"]
        raw["styles"].append(dict(id="script", vertical_align="super"))
        block["content"]["spans"].append(
            dict(id="script-range", start=0, end=len(text), style_id="script")
        )
        address = next(a for a in raw["addresses"] if a["fragment"] == block["id"])
        raw["addresses"].append({**address, "fragment": "script-range"})
        book = CanonicalBookV2.model_validate(raw)
        self.assertEqual("ava-epub-canonical-2.3", export_profile(book, split_sections=False))
        entries = export_entries(book, {})
        path = next(p for p in entries if p.startswith("EPUB/text/"))
        node = next(n for n in ET.fromstring(entries[path]).iter() if n.get("data-ava-text"))
        self.assertEqual({"page-1": 0, "page-2": 4, "page-3": 16}, marker_offsets(node))
        self.assertEqual(text, "".join(node.itertext()))
        self.assertEqual(codepoint_to_utf16(text), book.blocks[0].content.codepoint_utf16)
        self.assertEqual((book, {}), portable_epub(export_epub(book, {})))
        self.assertEqual(
            (book, {}), portable_epub(export_epub(book, {}, profile="ava-epub-canonical-2.3"))
        )

    def test_note_callers_and_table_cells_share_projection(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        body = next(b for b in raw["blocks"] if b["id"] == "body-one")
        body["content"]["normalization"] = (
            None  # Newly authored characters have no source-normalization claim.
        )
        body["content"]["text"] = body["content"]["text"].replace("[1]", "[¹]")
        body["content"]["sha256"] = hashlib.sha256(body["content"]["text"].encode()).hexdigest()
        for span in body["content"]["spans"]:
            span["style_id"] = "super"
        cell = next(b for b in raw["blocks"] if b["kind"] == "table")["cells"][0]
        text = cell["content"]["text"] + "₂"
        cell["content"].update(
            text=text,
            sha256=hashlib.sha256(text.encode()).hexdigest(),
            codepoint_utf16=codepoint_to_utf16(text),
        )
        cell["content"]["spans"].append(
            dict(id="cell-sub", start=len(text) - 1, end=len(text), style_id="sub")
        )
        address = next(a for a in raw["addresses"] if a["fragment"] == cell["id"])
        raw["addresses"].append(
            {
                **address,
                "fragment": "cell-sub",
                "target": {**address["target"], "offset": len(text) - 1},
            }
        )
        book = CanonicalBookV2.model_validate(raw)
        ctx = Context(book, intrinsic_scripts=True)
        tree = render_text(ctx.nodes["body-one"], ctx)
        self.assertEqual(2, sum(n.tag.endswith("}a") for n in tree.iter()))
        self.assertEqual(2, sum(n.get("style") == "vertical-align:baseline" for n in tree.iter()))
        for call in ["call-1a", "call-1b"]:
            self.assertTrue(ctx.backlink(call).endswith("#" + ident("s", call)))
            self.assertEqual(1, sum(n.get("id") == ident("s", call) for n in tree.iter()))
        tree = render_text(ctx.nodes[cell["id"]], ctx)
        self.assertEqual(text, "".join(tree.itertext()))
        self.assertEqual(1, sum(n.get("style") == "vertical-align:baseline" for n in tree.iter()))
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))
