"""Source label scalars and continuation evidence survive decoration separation."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .note_marker_fixtures import link_graph, note


class PrintedNoteIdentity(unittest.TestCase):
    def test_bracket_keys_keep_unicode_symbols_case_and_leading_zeroes(self):
        for key in ("07", "A", "iv", "*", "é", "７", "٧"):
            with self.subTest(key=key):
                original = note("body", f"[{key}] Note.", f"[{key}]")
                result = printed_markers([original], AssemblyState())[0]
                self.assertEqual(key, result.note_label)
                self.assertEqual("Note.", result.text)
        for text, label in [("1.2 Note.", "1.2"), ("(7) Note.", "(7)")]:
            with self.subTest(text=text):
                original = note("body", text, label)
                self.assertEqual(original, printed_markers([original], AssemblyState())[0])

    def test_local_note_still_wins_endnote_fallback(self):
        state = link_graph(
            [("local-caller", "First[7]."), ("remote-caller", "Again[7].")],
            [
                note("local", "7. Local.", "7.", "footnote"),
                note("end", "[7] Global.", "[7]", "endnote"),
            ],
            [("one", ["local-caller", "local"]), ("two", ["remote-caller"]), ("notes", ["end"])],
        )
        self.assertEqual("local", state.blocks[0]["content"]["spans"][0]["link"]["block_id"])
        self.assertEqual("end", state.blocks[1]["content"]["spans"][0]["link"]["block_id"])

    def test_declared_note_continuation_keeps_both_source_regions_and_alias(self):
        first = note("a", "7. First", "7.").model_copy(
            update={
                "continues_to_next": True,
                "native_line_ids": ["line-a"],
            }
        )
        second = note("b", "[7] continuation.", "[7]").model_copy(
            update={
                "page": 2,
                "continues_from_previous": True,
                "native_line_ids": ["line-b"],
            }
        )
        state = AssemblyState(evidence={"a": [{"page": 1}], "b": [{"page": 2}]})
        result = stream_joins(printed_markers([first, second], state), state)
        self.assertEqual(1, len(result))
        self.assertEqual("First continuation.", result[0].text)
        self.assertEqual("7", result[0].note_label)
        self.assertEqual(["line-a", "line-b"], result[0].native_line_ids)
        self.assertEqual([{"page": 1}, {"page": 2}], state.evidence["a"])
        self.assertEqual(("a", 6), state.aliases["b"])

    def test_unmarked_conflicting_continuation_does_not_borrow_previous_label(self):
        first = note("a", "7. First", "7.").model_copy(update={"continues_to_next": True})
        second = note("b", "Continuation.", "7.").model_copy(
            update={
                "page": 2,
                "continues_from_previous": True,
            }
        )
        state = AssemblyState(evidence={"a": [{"page": 1}], "b": [{"page": 2}]})
        with self.assertRaisesRegex(ValueError, "Unresolved prose continuation"):
            stream_joins(printed_markers([first, second], state), state)


if __name__ == "__main__":
    unittest.main()
