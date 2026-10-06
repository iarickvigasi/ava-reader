"""A repeated source body reference preserves real point-size differences, not page mixtures."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_document_sizes import normalize_native_sizes

from .native_size_fixture import document, segment


class NativeDocumentSizes(unittest.TestCase):
    def test_shared_reference_preserves_true_sizes_inline_ratios_and_all_other_fields(self):
        items = [
            segment("body1", 1),
            segment("body2", 2),
            segment("larger-body", 3, 14),
            segment("heading", 3, 18, "heading", 1, y=100),
            segment("register", 3, 10, "code", 3, y=200),
        ]
        values, pages = document(items)
        state = AssemblyState()
        actual = normalize_native_sizes(values, pages, state)
        self.assertEqual([1, 1, 14 / 12, 18 / 12, 10 / 12], [s.style.relative_size for s in actual])
        for old, new in zip(values, actual, strict=True):
            self.assertEqual(old.model_dump(exclude={"style"}), new.model_dump(exclude={"style"}))
            self.assertEqual(
                old.style.model_dump(exclude={"relative_size"}),
                new.style.model_dump(exclude={"relative_size"}),
            )
        self.assertEqual(
            ["NATIVE_DOCUMENT_SIZE_REFERENCE"], [f.code for f in state.structure_findings]
        )

    def test_dense_nonbody_material_does_not_supply_the_reference(self):
        items = [segment("body1", 1), segment("body2", 2)]
        for page in [1, 2]:
            for i, kind in enumerate(
                ["heading", "credit", "caption", "code", "verse", "furniture"]
            ):
                items.append(segment(f"{kind}{page}", page, 9, kind, 2, y=100 + i * 80))
            item, rows = segment(f"centered{page}", page, 9, y=650)
            items.append(
                (
                    item.model_copy(
                        update={"style": item.style.model_copy(update={"align": "center"})}
                    ),
                    rows,
                )
            )
        values, pages = document(items)
        actual = normalize_native_sizes(values, pages, AssemblyState())
        self.assertEqual([1, 1], [s.style.relative_size for s in actual[:2]])
        self.assertTrue(all(s.style.relative_size == 9 / 12 for s in actual[2:]))

    def test_ocr_null_sizes_and_aside_typography_are_unchanged(self):
        items = [segment("body1", 1), segment("body2", 2)]
        ocr, rows = segment("ocr", 3, 16, method="ocr", native_line_ids=[])
        aside, aside_rows = segment("aside", 3, 11, "aside", y=100)
        aside = aside.model_copy(update={"style": Style(id="aside", family="sans-serif")})
        values, pages = document([*items, (ocr, rows), (aside, aside_rows)])
        actual = normalize_native_sizes(values, pages, AssemblyState())
        self.assertEqual(values[2:], actual[2:])

    def test_out_of_contract_size_is_retained_without_clamping(self):
        values, pages = document(
            [
                segment("body1", 1),
                segment("body2", 2),
                segment("large", 3, 48, "heading", 1, style=Style(id="large", relative_size=2)),
            ]
        )
        state = AssemblyState()
        result = normalize_native_sizes(values, pages, state)
        self.assertEqual(values[-1], result[-1])
        self.assertIn(
            "NATIVE_DOCUMENT_SIZE_OUT_OF_PROFILE", [f.code for f in state.structure_findings]
        )

    def test_rebase_uses_retained_first_line_not_median_of_joined_lines(self):
        first, rows = segment("changed", 3, 14)
        rows[1] = rows[1].model_copy(
            update={"glyphs": [rows[1].glyphs[0].model_copy(update={"size": 20})]}
        )
        values, pages = document([segment("base1", 1), segment("base2", 2), (first, rows)])
        actual = normalize_native_sizes(values, pages, AssemblyState())
        self.assertEqual(14 / 12, actual[-1].style.relative_size)
        self.assertEqual(first.spans, actual[-1].spans)
