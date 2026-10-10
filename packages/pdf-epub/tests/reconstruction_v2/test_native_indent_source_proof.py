"""Partial, reused, invisible or uncontained native ink cannot prove an extra offset."""

import unittest

from .native_indent_recovery_fixture import paragraph, recover, single


class NativeIndentSourceProofTests(unittest.TestCase):
    def test_missing_duplicate_and_reused_line_ids_refuse(self):
        for ids in [["b-a", "missing"], ["b-a", "b-a"], ["a-a", "a-b"]]:
            peer, rows = paragraph("b", top=60)
            peer = peer.model_copy(update={"native_line_ids": ids})
            result, _ = recover([paragraph("a"), (peer, rows), single()])
            self.assertIsNone(result[-1].style.indent_em)

    def test_invisible_empty_font_uncontained_or_empty_glyphs_refuse(self):
        for change in [{"visible": False}, {"font": ""}, {"font": "AAAAAA+"}, {"font": " "}]:
            peer, rows = paragraph("b", top=60)
            rows[0] = rows[0].model_copy(
                update={"glyphs": [g.model_copy(update=change) for g in rows[0].glyphs]}
            )
            result, _ = recover([paragraph("a"), (peer, rows), single()])
            self.assertIsNone(result[-1].style.indent_em)
        peer, rows = paragraph("b", top=60)
        glyph = rows[0].glyphs[0]
        rows[0] = rows[0].model_copy(
            update={
                "glyphs": [
                    glyph.model_copy(
                        update={"box": glyph.box.model_copy(update={"x1": glyph.box.x1 + 1})}
                    )
                ]
            }
        )
        self.assertIsNone(recover([paragraph("a"), (peer, rows), single()])[0][-1].style.indent_em)
        rows[0] = rows[0].model_copy(update={"glyphs": []})
        self.assertIsNone(recover([paragraph("a"), (peer, rows), single()])[0][-1].style.indent_em)

    def test_incomplete_target_and_shared_source_ink_refuse(self):
        target, rows = single()
        target = target.model_copy(update={"native_line_ids": ["single", "missing"]})
        self.assertIsNone(
            recover([paragraph("a"), paragraph("b", top=60), (target, rows)])[0][-1].style.indent_em
        )
        a, rows = paragraph("a")
        b = a.model_copy(update={"id": "b", "native_line_ids": ["b-a", "b-b"]})
        copied = [
            r.model_copy(update={"id": i}) for r, i in zip(rows, b.native_line_ids, strict=True)
        ]
        self.assertIsNone(recover([(a, rows), (b, copied), single()])[0][-1].style.indent_em)

    def test_tiny_positive_raw_size_does_not_round_to_zero(self):
        groups = [
            paragraph("a", delta=0.0008),
            paragraph("b", delta=0.0008, top=60),
            single(left=40.0008),
        ]
        tiny = [
            (
                s,
                [
                    r.model_copy(
                        update={"glyphs": [g.model_copy(update={"size": 0.0004}) for g in r.glyphs]}
                    )
                    for r in rows
                ],
            )
            for s, rows in groups
        ]
        self.assertAlmostEqual(2, recover(tiny)[0][-1].style.indent_em)
