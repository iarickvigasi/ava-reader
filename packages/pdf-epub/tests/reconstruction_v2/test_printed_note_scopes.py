"""Printed decoration cannot widen note ownership or resolve duplicate targets."""

import unittest

from .note_marker_fixtures import link_graph, note


class PrintedNoteScopes(unittest.TestCase):
    def test_restarted_local_labels_remain_owned_by_their_chapter(self):
        state = link_graph(
            [("caller-a", "First[7]."), ("caller-b", "Again[7].")],
            [
                note("a", "7. Earlier note.", "7.", "footnote"),
                note("b", "[7] Later note.", "[7]", "footnote"),
            ],
            [("one", ["caller-a", "a"]), ("two", ["caller-b", "b"])],
        )
        for caller, ident, chapter in [
            (state.blocks[0], "a", "one"),
            (state.blocks[1], "b", "two"),
        ]:
            self.assertEqual(
                dict(kind="note", chapter_id=chapter, block_id=ident, offset=0),
                caller["content"]["spans"][0]["link"],
            )

    def test_duplicate_local_or_endnote_labels_still_refuse_ambiguity(self):
        for role, chapters in [
            ("footnote", [("one", ["caller", "a", "b"])]),
            ("endnote", [("one", ["caller"]), ("notes", ["a", "b"])]),
        ]:
            with self.subTest(role=role):
                with self.assertRaisesRegex(ValueError, "ambiguous printed note callout"):
                    link_graph(
                        [("caller", "See[7].")],
                        [note("a", "7. First.", "7.", role), note("b", "[7] Second.", "[7]", role)],
                        chapters,
                    )

    def test_crosschapter_footnote_is_not_promoted_to_endnote(self):
        with self.assertRaisesRegex(ValueError, "Unresolved"):
            link_graph(
                [("caller", "See[7].")],
                [note("body", "7. Note.", "7.", "footnote")],
                [("one", ["caller"]), ("two", ["body"])],
            )

    def test_unmatched_note_and_nonidentical_leading_zero_label_remain_blocking(self):
        for text in ["No callout.", "See[7]."]:
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    link_graph(
                        [("caller", text)],
                        [note("body", "07. Note.", "07.")],
                        [("one", ["caller", "body"])],
                    )


if __name__ == "__main__":
    unittest.main()
