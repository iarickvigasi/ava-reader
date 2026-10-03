import hashlib
import unittest

from pydantic import ValidationError

from ava_pdf_epub.models import Block, Book, Chapter, Claim, Evidence, Page, Span


def example_book():
    return Book(
        source_sha256="a" * 64,
        page_count=1,
        pages=[
            Page(
                number=1,
                width=100.0,
                height=200.0,
                route="native",
                blocks=[
                    Block(
                        id="p1",
                        text="A book",
                        kind="paragraph",
                        evidence=[Evidence(page=1, method="native")],
                    )
                ],
            )
        ],
        chapters=[Chapter(id="ch1", title="Book", start_block_id="p1")],
    )


class ContractTests(unittest.TestCase):
    def test_stale_offset_revision_is_rejected(self):
        with self.assertRaises(ValidationError):
            Block(
                id="b1",
                kind="paragraph",
                text="changed",
                text_sha256=hashlib.sha256(b"old").hexdigest(),
                spans=[Span(start=0, end=3, kind="em")],
                evidence=[Evidence(page=1, method="native")],
            )

    def test_offsets_use_codepoints_and_reject_overlapping_links(self):
        block = Block(
            id="b1",
            kind="paragraph",
            text="😀text",
            spans=[Span(start=1, end=5, kind="em")],
            evidence=[Evidence(page=1, method="native")],
        )
        self.assertEqual(block.text[block.spans[0].start : block.spans[0].end], "text")
        with self.assertRaises(ValidationError):
            Block(
                id="b1",
                kind="paragraph",
                text="abc",
                spans=[
                    Span(start=0, end=2, kind="link", target="x"),
                    Span(start=1, end=3, kind="link", target="y"),
                ],
                evidence=[Evidence(page=1, method="native")],
            )

    def test_missing_pages_and_duplicate_blocks_do_not_pass(self):
        source = example_book().model_dump()
        source["page_count"] = 2
        with self.assertRaises(ValidationError):
            Book.model_validate(source)
        source["page_count"] = 1
        source["pages"][0]["blocks"] *= 2
        with self.assertRaises(ValidationError):
            Book.model_validate(source)

    def test_chapter_boundary_must_exist(self):
        source = example_book().model_dump()
        source["chapters"][0]["start_block_id"] = "absent"
        with self.assertRaises(ValidationError):
            Book.model_validate(source)

    def test_schema_does_not_accept_arbitrary_model_html(self):
        source = example_book().model_dump()
        source["pages"][0]["blocks"][0]["html"] = "<script>run()</script>"
        with self.assertRaises(ValidationError):
            Book.model_validate(source)

    def test_metadata_and_asset_evidence_cannot_claim_nonexistent_source(self):
        book = example_book()
        raw = book.model_dump()
        raw["metadata"] = [
            Claim(
                field="title",
                value="False source",
                status="accepted",
                evidence=[Evidence(page=2, method="review")],
            ).model_dump()
        ]
        with self.assertRaisesRegex(ValidationError, "Evidence outside source"):
            Book.model_validate(raw)
        raw["metadata"] = []
        raw["pages"][0]["blocks"][0]["evidence"][0]["bbox"] = (0.5, 0.0, 0.1, 0.5)
        with self.assertRaisesRegex(ValidationError, "Evidence rectangle"):
            Book.model_validate(raw)

    def test_invalid_xml_characters_in_metadata_are_rejected(self):
        with self.assertRaises(ValidationError):
            Claim(field="title", value="bad\x00title")


if __name__ == "__main__":
    unittest.main()
