"""Raw measurements outside the style contract cannot be rounded into acceptance."""

import unittest

from ava_pdf_epub.reconstruction_v2.index_indent_geometry import (
    IndexIndentGeometry,
    measured_index_indents,
)

from .test_refinement_grouping import segment


class IndexIndentGeometryTests(unittest.TestCase):
    def test_contract_limits_apply_before_rounding_and_nonfinite_values_refuse(self):
        owner = segment("owner", "entry 12")
        for margins in [(6.0000004,), (0, 3.0000004), (float("inf"),), (float("nan"),)]:
            with self.subTest(margins=margins):
                entry = IndexIndentGeometry(owner, 1, 1, margins, "RootFont")
                self.assertIsNone(measured_index_indents(entry, 0))
        inside = IndexIndentGeometry(owner, 1, 1, (5.9999996,), "RootFont")
        self.assertEqual(5.9999996, measured_index_indents(inside, 0)["block_indent_em"])
