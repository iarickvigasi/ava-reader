"""The physical table bound includes header rows and header columns."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.conservation import native_conservation
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page

FIXTURES = Path(__file__).parent / "fixtures"


class TableBoundaries(unittest.TestCase):
    def test_twenty_by_eight_is_inclusive_and_conserves_all_cells(self):
        with tempfile.TemporaryDirectory() as folder:
            page = prepare_page(FIXTURES / "fx-table-20x8.pdf", Path(folder), 1)
            self.assertEqual([], page.tasks)
            table = next(s for s in page.native_segments if s.kind == "table")
            self.assertEqual(20, len(table.cells))
            self.assertTrue(all(len(row) == 8 for row in table.cells))
            self.assertEqual(
                [
                    [
                        f"C{c + 1}" if r == 0 else f"R{r}" if c == 0 else f"{r}.{c + 1}"
                        for c in range(8)
                    ]
                    for r in range(20)
                ],
                [[cell.text for cell in row] for row in table.cells],
            )
            native_conservation(page.observation, page.native_segments, [])

    def test_over_either_physical_axis_refuses_before_provider_dispatch(self):
        for name in ["fx-table-21x8.pdf", "fx-table-20x9.pdf"]:
            with tempfile.TemporaryDirectory() as folder:
                with self.assertRaisesRegex(ValueError, "supported grid"):
                    prepare_page(FIXTURES / name, Path(folder), 1)


if __name__ == "__main__":
    unittest.main()
