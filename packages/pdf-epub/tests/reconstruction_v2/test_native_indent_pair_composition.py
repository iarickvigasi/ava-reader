"""A new coordinate must not double or contradict an already known source offset."""

import unittest

from .native_indent_recovery_fixture import paragraph, recover, single


class NativeIndentPairCompositionTests(unittest.TestCase):
    def test_conflicting_known_first_coordinate_blocks_new_hanging_inset(self):
        for known in [0, -1]:
            target, rows = single(left=20)
            target = target.model_copy(
                update={"style": target.style.model_copy(update={"indent_em": known})}
            )
            result, state = recover(
                [paragraph("a", delta=-20), paragraph("b", delta=-20, top=60), (target, rows)]
            )
            self.assertEqual(target, result[-1])
            self.assertTrue(
                any(
                    f.code == "NATIVE_INDENT_KNOWN_STYLE_CONFLICT" for f in state.structure_findings
                )
            )

    def test_matching_hanging_first_coordinate_keeps_compensating_pair(self):
        target, rows = single(left=20)
        target = target.model_copy(
            update={"style": target.style.model_copy(update={"indent_em": -2})}
        )
        result, _ = recover(
            [paragraph("a", delta=-20), paragraph("b", delta=-20, top=60), (target, rows)]
        )
        self.assertEqual(-2, result[-1].style.indent_em)
        self.assertEqual(2, result[-1].style.block_indent_em)

    def test_known_whole_block_coordinate_blocks_extra_first_line_shift(self):
        target, rows = single()
        target = target.model_copy(
            update={"style": target.style.model_copy(update={"block_indent_em": 2})}
        )
        result, _ = recover([paragraph("a"), paragraph("b", top=60), (target, rows)])
        self.assertEqual(target, result[-1])
