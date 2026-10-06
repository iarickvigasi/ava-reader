"""Only regular matching native body paragraphs qualify a local indent pattern."""

import unittest

from .native_indent_recovery_fixture import paragraph, recover, single


class NativeIndentReferenceRefusals(unittest.TestCase):
    def test_italic_centered_literal_and_note_peers_refuse(self):
        for change in [
            {"kind": "note", "note_label": "1", "note_role": "endnote"},
            {"kind": "quote"},
            {"kind": "list_item", "list_depth": 1, "list_ordered": False},
            {"preserve_line_breaks": True},
        ]:
            peer, rows = paragraph("b", top=60)
            result, _ = recover([paragraph("a"), (peer.model_copy(update=change), rows), single()])
            self.assertIsNone(result[-1].style.indent_em)
        for change in [{"italic": True}, {"align": "center"}, {"bold": True}]:
            peer, rows = paragraph("b", top=60)
            peer = peer.model_copy(update={"style": peer.style.model_copy(update=change)})
            result, _ = recover([paragraph("a"), (peer, rows), single()])
            self.assertIsNone(result[-1].style.indent_em)

    def test_changed_raw_typeface_or_point_size_refuses(self):
        for change in [{"font": "OtherFace"}, {"size": 12}]:
            peer, rows = paragraph("b", top=60)
            rows = [
                r.model_copy(update={"glyphs": [g.model_copy(update=change) for g in r.glyphs]})
                for r in rows
            ]
            result, _ = recover([paragraph("a"), (peer, rows), single()])
            self.assertIsNone(result[-1].style.indent_em)

    def test_other_column_and_ocr_target_refuse(self):
        result, _ = recover(
            [paragraph("a", margin=240), paragraph("b", margin=240, top=60), single(top=25)]
        )
        self.assertIsNone(result[-1].style.indent_em)
        target, rows = single()
        result, _ = recover(
            [
                paragraph("a"),
                paragraph("b", top=60),
                (target.model_copy(update={"method": "ocr"}), rows),
            ]
        )
        self.assertEqual(target.text, result[-1].text)
        self.assertIsNone(result[-1].style.indent_em)
