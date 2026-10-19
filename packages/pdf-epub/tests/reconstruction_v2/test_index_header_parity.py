"""Matching source coordinates do not combine recto and verso cohorts."""

import tempfile
import unittest
from pathlib import Path

from .index_header_fixture import header_case
from .index_header_guard_fixture import unchanged


class IndexHeaderParity(unittest.TestCase):
    def test_three_mixed_parity_pages_are_not_three_same_parity_witnesses(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, owners = header_case(Path(directory), same_side=True)
            pages = [p for p in pages if p.observation.number in {2, 3, 4}]
            owners = {n: v for n, v in owners.items() if n in {2, 3, 4}}
            self.assertTrue(unchanged(source, pages, owners))
