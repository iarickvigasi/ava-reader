"""Observed decoration supplies a note key; it never authorizes a different label."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .note_marker_fixtures import link_graph, note


class PrintedNoteLabels(unittest.TestCase):
    def test_observed_decimal_and_bracket_decorations_bind_both_return_origins(self):
        for text, label in [
            ("7. Useful note.", "7."),
            ("[7] Useful note.", "[7]"),
            ("[7] Useful note.", "7"),
            ("7. Useful note.", "7"),
        ]:
            with self.subTest(text=text, label=label):
                state = link_graph(
                    [("caller-a", "First[7]."), ("caller-b", "Again[7].")],
                    [note("body", text, label)],
                    [("opening", ["caller-a", "caller-b"]), ("notes", ["body"])],
                )
                a, b, body = state.blocks
                self.assertEqual("Useful note.", body["content"]["text"])
                self.assertEqual("7", body["label"])
                self.assertEqual(["caller-a-note5", "caller-b-note5"], body["callout_ids"])
                for caller in (a, b):
                    span = caller["content"]["spans"][0]
                    self.assertEqual((5, 8), (span["start"], span["end"]))
                    self.assertEqual(
                        dict(kind="note", chapter_id="notes", block_id="body", offset=0),
                        span["link"],
                    )

    def test_source_text_spans_targets_and_identity_survive_marker_separation(self):
        original = note("body", "7. Useful note.", "7.").model_copy(
            update={
                "method": "native",
                "source_text": "7. Useful note.",
                "style": Style(id="body-style", relative_size=0.8),
                "spans": [ObservedSpan(start=3, end=9, style=Style(id="ink", bold=True))],
            }
        )
        state = AssemblyState(internal_targets=[("body", 3, 9, "destination", 2)])
        result = printed_markers([original], state)[0]
        self.assertEqual("7. Useful note.", original.text)
        self.assertEqual("Useful note.", result.text)
        self.assertEqual(result.text, result.source_text)
        self.assertEqual((0, 6), (result.spans[0].start, result.spans[0].end))
        self.assertEqual(original.spans[0].style, result.spans[0].style)
        self.assertEqual([("body", 0, 6, "destination", 2)], state.internal_targets)
        for field in ("id", "page", "method", "box", "style", "note_role"):
            self.assertEqual(getattr(original, field), getattr(result, field))

    def test_conflicting_labels_are_not_guessed_from_the_prefix(self):
        for text, label in [
            ("7. Note.", "8"),
            ("[7] Note.", "8"),
            ("07. Note.", "7"),
            ("[I] Note.", "1"),
            ("[a] Note.", "A"),
            ("[é] Note.", "e\u0301"),
            ("7. Note.", "[7]"),
        ]:
            with self.subTest(text=text, label=label):
                with self.assertRaisesRegex(ValueError, "printed note label"):
                    printed_markers([note("body", text, label)], AssemblyState())

    def test_unmarked_and_already_normalized_labels_are_retained(self):
        for text, label in [("Unmarked note.", "7."), ("7. Note.", "7")]:
            with self.subTest(text=text):
                result = printed_markers([note("body", text, label)], AssemblyState())[0]
                self.assertEqual(label, result.note_label)


if __name__ == "__main__":
    unittest.main()
