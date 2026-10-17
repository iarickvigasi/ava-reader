"""An exact author-declared folio can identify a native reference beside a comma."""

import hashlib
import unittest
from unittest.mock import patch

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.extract import sha256_file
from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.literal_page_label import (
    explicit_decimal_label,
    literal_page_label_range,
)
from ava_pdf_epub.reconstruction_v2.native_line_offsets import NativeLineOffset
from ava_pdf_epub.reconstruction_v2.pdf_links import apply_pdf_links
from tests.reconstruction_v2 import test_native_caller_context as fixture


class LiteralPageLabelTests(unittest.TestCase):
    def fixture(self):
        helper = fixture.NativeCallerContextTests()
        self.addCleanup(helper.doCleanups)
        root, source, checkpoint, owner, _ = helper.fixture(text="no end 54, 58–9")
        caller = fixture.rectangle(52, 20, 65, 34)
        writer = PdfWriter(clone_from=source)
        writer._root_object[NameObject("/PageLabels")] = DictionaryObject(
            {
                NameObject("/Nums"): ArrayObject(
                    [
                        NumberObject(0),
                        DictionaryObject(
                            {
                                NameObject("/S"): NameObject("/D"),
                                NameObject("/St"): NumberObject(54),
                            }
                        ),
                    ]
                ),
            }
        )
        annotation = writer.pages[0]["/Annots"][0].get_object()
        annotation[NameObject("/Rect")] = ArrayObject([NumberObject(v) for v in (52, 66, 65, 80)])
        annotation[NameObject("/A")] = DictionaryObject(
            {
                NameObject("/S"): NameObject("/GoTo"),
                NameObject("/D"): ArrayObject(
                    [writer.pages[0].indirect_reference, NameObject("/Fit")]
                ),
            }
        )
        writer.write(source)
        page = checkpoint.observation.model_copy(update={"risks": ["language_uncertain"]})
        checkpoint = checkpoint.model_copy(
            update={
                "observation": page,
                "source_sha256": sha256_file(source),
                "source_byte_length": source.stat().st_size,
            }
        )
        line = page.lines[0]
        mapping = NativeLineOffset(
            line_id=line.id,
            segment_id=owner.id,
            start=8,
            end=8 + len(line.text),
            text_sha256=hashlib.sha256(line.text.encode()).hexdigest(),
        )
        return root, source, checkpoint, owner, caller, {line.id: mapping}

    def test_stock_link_keeps_native_text_style_comma_and_destination_without_ocr(self):
        root, source, checkpoint, owner, caller, maps = self.fixture()
        before = owner.model_dump()
        reader = PdfReader(source)
        self.assertEqual("54", explicit_decimal_label(reader, NavigationTarget(page=1)))
        self.assertEqual(
            [("owner", 15, 17)],
            literal_page_label_range(
                reader,
                NavigationTarget(page=1),
                checkpoint.observation,
                [owner],
                caller,
                maps,
                annotation=reader.pages[0]["/Annots"][0].get_object(),
            ),
        )
        state = AssemblyState(native_line_maps=maps)
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words"
        ) as ocr:
            result = apply_pdf_links(source, [checkpoint], [owner], state, root)
            ocr.assert_not_called()
        self.assertEqual(before, result[0].model_dump())
        self.assertEqual([("owner", 15, 17, "owner", 0)], state.internal_targets)
        self.assertEqual(
            ["PDF_LINK_PAGE_LABEL_CORROBORATED"], [f.code for f in state.structure_findings]
        )

    def test_implicit_duplicated_prefixed_roman_positioned_and_wrong_label_refuse(self):
        _, source, checkpoint, owner, caller, maps = self.fixture()
        for mode in (
            "implicit",
            "duplicate",
            "prefix",
            "roman",
            "positioned",
            "wrong-label",
            "nested",
        ):
            with self.subTest(mode=mode):
                writer = PdfWriter(clone_from=source)
                target = NavigationTarget(page=1)
                tree = writer._root_object["/PageLabels"]
                rule = tree["/Nums"][1]
                if mode == "implicit":
                    del writer._root_object["/PageLabels"]
                elif mode == "duplicate":
                    writer.add_blank_page(width=100, height=100)
                    tree["/Nums"].extend([NumberObject(1), rule])
                elif mode == "prefix":
                    rule[NameObject("/P")] = NameObject("/prefix")
                elif mode == "roman":
                    rule[NameObject("/S")] = NameObject("/r")
                elif mode == "positioned":
                    target = NavigationTarget(page=1, top=1)
                elif mode == "wrong-label":
                    rule[NameObject("/St")] = NumberObject(55)
                elif mode == "nested":
                    tree[NameObject("/Kids")] = ArrayObject([])
                path = source.with_name(mode + ".pdf")
                writer.write(path)
                reader = PdfReader(path)
                self.assertIsNone(
                    literal_page_label_range(
                        reader,
                        target,
                        checkpoint.observation,
                        [owner],
                        caller,
                        maps,
                        annotation=reader.pages[0]["/Annots"][0].get_object(),
                    )
                )

    def test_missing_map_hidden_artifact_other_risk_partial_digit_and_comma_center_refuse(self):
        _, source, checkpoint, owner, caller, maps = self.fixture()
        for mode in (
            "map",
            "hidden",
            "artifact",
            "risk",
            "partial-digit",
            "comma-center",
            "extra-ink",
            "changed-owner",
            "different-suffix",
        ):
            with self.subTest(mode=mode):
                page = checkpoint.observation.model_copy(deep=True)
                local = owner
                box = caller
                mapping = maps
                if mode == "map":
                    mapping = {}
                elif mode == "hidden":
                    page.lines[0].glyphs[0] = (
                        page.lines[0].glyphs[0].model_copy(update={"visible": False})
                    )
                elif mode == "artifact":
                    page.lines[0].glyphs[0] = (
                        page.lines[0].glyphs[0].model_copy(update={"source_artifact": True})
                    )
                elif mode == "risk":
                    page.risks.append("unknown")
                elif mode == "partial-digit":
                    box = fixture.rectangle(54, 20, 65, 34)
                elif mode == "comma-center":
                    box = fixture.rectangle(52, 20, 68, 34)
                elif mode == "extra-ink":
                    page.lines[0].glyphs[-1] = (
                        page.lines[0].glyphs[-1].model_copy(update={"box": caller})
                    )
                elif mode == "changed-owner":
                    local = owner.model_copy(update={"text": owner.text.replace("54", "55")})
                elif mode == "different-suffix":
                    page.lines[0] = page.lines[0].model_copy(
                        update={"text": page.lines[0].text.replace("54,", "54;")}
                    )
                try:
                    value = literal_page_label_range(
                        PdfReader(source),
                        NavigationTarget(page=1),
                        page,
                        [local],
                        box,
                        mapping,
                        annotation=PdfReader(source).pages[0]["/Annots"][0].get_object(),
                    )
                except ValueError:
                    value = None
                self.assertIsNone(value)

    def test_only_existing_constant_page_jump_grammar_can_supply_source_destination(self):
        root, source, checkpoint, owner, caller, maps = self.fixture()
        for script, expected in (
            ("this.zoom=100;this.pageNum=0", True),
            ("this.zoom=100;this.pageNum=1-1", False),
        ):
            writer = PdfWriter(clone_from=source)
            annotation = writer.pages[0]["/Annots"][0].get_object()
            annotation[NameObject("/A")] = DictionaryObject(
                {
                    NameObject("/S"): NameObject("/JavaScript"),
                    NameObject("/JS"): TextStringObject(script),
                }
            )
            path = root / ("constant.pdf" if expected else "expression.pdf")
            writer.write(path)
            reader = PdfReader(path)
            try:
                value = literal_page_label_range(
                    reader,
                    NavigationTarget(page=1),
                    checkpoint.observation,
                    [owner],
                    caller,
                    maps,
                    annotation=reader.pages[0]["/Annots"][0].get_object(),
                )
            except ValueError:
                value = None
            self.assertEqual(bool(value), expected)
