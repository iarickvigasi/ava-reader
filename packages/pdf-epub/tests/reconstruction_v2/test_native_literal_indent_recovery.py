"""Whole literal inset is distinct from preserved internal leading whitespace."""

import unittest

from .native_indent_recovery_fixture import paragraph, recover
from .source_indent_fixture import line, segment


class NativeLiteralIndentRecoveryTests(unittest.TestCase):
    def literal(self, left):
        rows = [
            line("literal-a", left, 100),
            line("literal-b", left + 24, 115),
            line("literal-c", left + 24, 130),
        ]
        value = segment("literal", rows).model_copy(
            update={
                "page": 2,
                "kind": "code",
                "text": "North quay\n    first watch\n    return journey",
                "style": segment("style", rows).style.model_copy(update={"align": "start"}),
            }
        )
        rows = [
            r.model_copy(
                update={"glyphs": [g.model_copy(update={"font": "Courier"}) for g in r.glyphs]}
            )
            for r in rows
        ]
        return value, rows

    def test_zero_positive_literal_insets_preserve_every_space(self):
        for left in [40, 60]:
            literal = self.literal(left)
            result, _ = recover([paragraph("a", number=1), literal, paragraph("b", number=3)])
            self.assertEqual((left - 40) / 10, result[1].style.block_indent_em)
            self.assertIsNone(result[1].style.indent_em)
            self.assertEqual(literal[0].text, result[1].text)
            self.assertEqual(literal[0].native_line_ids, result[1].native_line_ids)

    def test_sparse_ambiguous_literal_context_remains_unknown(self):
        result, state = recover([paragraph("a", number=1), self.literal(60)])
        self.assertIsNone(result[1].style.block_indent_em)
        self.assertTrue(any(f.block_id == "literal" for f in state.structure_findings))

    def test_known_literal_zero_is_compatible_but_nonzero_is_not_composed(self):
        for known in [0, 1]:
            value, rows = self.literal(60)
            value = value.model_copy(
                update={"style": value.style.model_copy(update={"indent_em": known})}
            )
            result, _ = recover([paragraph("a", number=1), (value, rows), paragraph("b", number=3)])
            self.assertEqual(known, result[1].style.indent_em)
            self.assertEqual(2 if known == 0 else None, result[1].style.block_indent_em)
