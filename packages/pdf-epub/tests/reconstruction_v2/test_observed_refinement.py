"""Apply separate authored decisions to exact retained semantic observations and source crops."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .observed_refinement import observed_case, observed_decisions


class ObservedRefinementTest(unittest.TestCase):
    def test_retained_prose_note_and_explicit_regular_style_survive_comparison(self):
        with tempfile.TemporaryDirectory() as directory:
            original, state, tasks = observed_case(Path(directory))
            before = [s.model_dump() for s in original]
            refined = apply_refinement(original, tasks, observed_decisions(tasks), state)
            result = stream_joins(refined, state)
        self.assertEqual(before, [s.model_dump() for s in original])
        self.assertEqual(" ".join(s.text for s in original), " ".join(s.text for s in result))
        self.assertEqual(len(original) - 1, len(result))
        by_id = {s.id: s for s in result}
        self.assertEqual(original[4].text + " " + original[5].text, by_id["s0005"].text)
        self.assertEqual(1.9, by_id["s0001"].style.relative_size)
        self.assertEqual(1.8, by_id["s0003"].style.relative_size)
        self.assertEqual(1.4, by_id["s0009"].style.relative_size)
        self.assertTrue(all(s.style.bold is False for s in result if s.kind == "heading"))
        self.assertEqual("sans-serif", by_id["s0003"].style.family)
        self.assertEqual(original[6].spans, by_id["s0007"].spans)
        self.assertEqual("[1]", by_id["s0007"].text[43:46])
        self.assertEqual([], state.structure_findings)
