import unittest

from ava_pdf_epub.contracts.page_starts import page_addresses
from ava_pdf_epub.reconstruction_v2.assemble_page_addresses import assemble_page_addresses
from ava_pdf_epub.reconstruction_v2.source_page_starts import capture_page_starts

from .page_start_test_fixture import joined_book


class SourcePageJoinTests(unittest.TestCase):
    def test_three_page_offsets_follow_actual_space_newline_and_compound_joins(self):
        cases = [
            (["Alpha carries", "the light onward", "and home."], False, " "),
            (["Alpha carries", "the light onward", "and home."], True, "\n"),
            (["будь-", "якому-", "місці"], False, ""),
        ]
        for parts, preserve, separator in cases:
            with self.subTest(separator=separator):
                book, segments, state, starts = joined_book(parts, preserve=preserve)
                text = separator.join(parts)
                self.assertEqual(text, book.blocks[0].content.text)
                for number, address in page_addresses(book).items():
                    expected = len(separator.join(parts[: number - 1])) + (
                        len(separator) if number > 1 else 0
                    )
                    self.assertEqual(expected, address.target.offset)
                    self.assertEqual(
                        parts[number - 1], text[expected : expected + len(parts[number - 1])]
                    )
                self.assertEqual({1, 2, 3}, set(starts))
                self.assertEqual(3, len(segments))
                self.assertEqual(
                    ("part-0", page_addresses(book)[3].target.offset), state.aliases["part-2"]
                )

    def test_emoji_combining_sequences_and_repeated_text_are_not_searched_or_normalized(self):
        for parts in [
            ["A😀B", "é continues", "and ends."],
            ["same text", "same text", "same text"],
        ]:
            book, _, _, _ = joined_book(parts)
            address = page_addresses(book)[2]
            content = book.blocks[0].content
            self.assertEqual(len(parts[0]) + 1, address.target.offset)
            self.assertEqual(
                parts[1],
                content.text[address.target.offset : address.target.offset + len(parts[1])],
            )
            self.assertEqual(
                len((parts[0] + " ").encode("utf-16-le")) // 2,
                content.codepoint_utf16[address.target.offset],
            )

    def test_first_column_start_survives_same_page_column_join_then_page_join(self):
        book, _, _, _ = joined_book(
            ["Alpha carries", "the light onward", "and home."], physical_pages=[1, 1, 2]
        )
        addresses = page_addresses(book)
        self.assertEqual({1, 2}, set(addresses))
        self.assertEqual(0, addresses[1].target.offset)
        self.assertEqual(len("Alpha carries the light onward "), addresses[2].target.offset)

    def test_captured_source_and_alias_proofs_refuse_corruption(self):
        for mode in ["missing", "wrong-offset", "cycle", "negative", "boolean", "collision"]:
            book, _, state, starts = joined_book(["Alpha carries", "the light onward"])
            addresses = [a.model_dump() for a in book.addresses if a.source_page is None]
            if mode == "missing":
                state.blocks.clear()
            elif mode == "collision":
                addresses.append(dict(fragment="ava-source-page-2"))
            else:
                state.aliases["part-1"] = (
                    ("part-1", 0)
                    if mode == "cycle"
                    else ("part-0", {"wrong-offset": 1, "negative": -1, "boolean": True}[mode])
                )
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                assemble_page_addresses(
                    starts, state, [c.model_dump() for c in book.chapters], addresses
                )

    def test_furniture_and_unowned_observations_cannot_be_captured(self):
        _, segments, state, _ = joined_book(["Alpha carries", "the light onward"])
        with self.assertRaisesRegex(ValueError, "furniture"):
            capture_page_starts([segments[0].model_copy(update={"kind": "furniture"})], state)
        original = state.evidence.pop(segments[0].id)
        with self.assertRaisesRegex(ValueError, "page-owned"):
            capture_page_starts(segments, state)
        state.evidence[segments[0].id] = original
        state.evidence[segments[0].id][0]["page"] = 2
        with self.assertRaisesRegex(ValueError, "page-owned"):
            capture_page_starts(segments, state)
