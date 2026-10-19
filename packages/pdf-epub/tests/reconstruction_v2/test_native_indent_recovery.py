"""Repeated local source paragraphs qualify single-line indentation without defaults."""

import unittest

from .native_indent_recovery_fixture import paragraph, recover, single


class NativeIndentRecoveryTests(unittest.TestCase):
    def test_positive_zero_and_hanging_patterns(self):
        for delta in [20, 0, -20]:
            with self.subTest(delta=delta):
                result, _ = recover(
                    [
                        paragraph("a", delta=delta),
                        paragraph("b", delta=delta, top=60),
                        single(left=40 + delta),
                    ]
                )
                self.assertEqual(delta / 10, result[-1].style.indent_em)
                self.assertEqual(2 if delta < 0 else None, result[-1].style.block_indent_em)

    def test_sparse_page_uses_matching_adjacent_page_peers(self):
        result, _ = recover([paragraph("a", number=1), single(number=2), paragraph("b", number=3)])
        self.assertEqual(2, result[1].style.indent_em)

    def test_one_peer_unknown_and_different_margins_refuse(self):
        for groups in [
            [paragraph("a"), single()],
            [paragraph("a"), paragraph("b", margin=50, top=60), single()],
            [paragraph("a", number=1), single(number=2), paragraph("b", margin=70, number=3)],
        ]:
            result, state = recover(groups)
            target = next(s for s in result if s.id == "single")
            self.assertIsNone(target.style.indent_em)
            self.assertTrue(any(f.block_id == target.id for f in state.structure_findings))

    def test_distant_peer_and_conflicting_first_pattern_refuse(self):
        for groups in [
            [paragraph("a", number=1), single(number=2), paragraph("b", number=4)],
            [paragraph("a"), paragraph("b", delta=0, top=60), single()],
        ]:
            result, _ = recover(groups)
            self.assertIsNone(next(s for s in result if s.id == "single").style.indent_em)

    def test_explicit_style_and_source_text_are_preserved(self):
        target, rows = single()
        target = target.model_copy(
            update={"style": target.style.model_copy(update={"indent_em": 0})}
        )
        result, _ = recover([paragraph("a"), paragraph("b", top=60), (target, rows)])
        self.assertEqual(target, result[-1])
