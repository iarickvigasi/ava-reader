"""Authored bibliography facts stay source candidates unless labelled authority establishes them."""

import copy
import io
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata
from tests.epub_v2.helpers import fixture

from .metadata_helpers import body, metadata_state, paragraph, title

ISBN10 = "0-306-40615-2"
ISBN13 = "9780000000002"


def source_state(text, front=True):
    return metadata_state(
        [title(), paragraph(text, page=2), body()] if front else [body(), paragraph(text, page=2)]
    )


def identifiers(claims):
    return [
        c for c in claims if c["field"] == "identifier" and c.get("identifier_scheme") == "isbn"
    ]


class PrintedIdentifiers(unittest.TestCase):
    def test_bare_front_record_preserves_candidate_year_identifier_and_unchanged_source(self):
        state = source_state(f"The Guide / River Press 2004 {ISBN10}")
        before = copy.deepcopy(state.blocks)
        claims = printed_metadata(state, None)
        self.assertEqual(
            [("0306406152", "candidate")], [(c["value"], c["status"]) for c in identifiers(claims)]
        )
        dates = [c for c in claims if c["field"] == "date"]
        self.assertEqual(
            [("2004", "candidate", "source_edition")],
            [(c["value"], c["status"], c["scope"]) for c in dates],
        )
        self.assertEqual(state.blocks[1]["evidence"], identifiers(claims)[0]["evidence"])
        self.assertFalse(any(c["field"] == "publisher" for c in claims))
        self.assertEqual(before, state.blocks)

    def test_explicit_middle_no_colon_unicode_separators_and_multiple_values(self):
        state = source_state("Catalogue ISBN 0‑306‑40615‑2; other ISBN-13:\u00a09790000000001 2004")
        claims = printed_metadata(state, None)
        self.assertEqual(["0306406152", "9790000000001"], [c["value"] for c in identifiers(claims)])
        self.assertTrue(all(c["status"] == "candidate" for c in identifiers(claims)))
        self.assertFalse(any(c["field"] == "date" for c in claims))

    def test_labelled_qualifiers_and_wrapped_groups_preserve_authority_and_source(self):
        for text in [
            "ISBN (pbk): 0-306-40615-2",
            "Printed ISBN (paperback): 978-0-00-000000-2",
            "ISBN: 0-\n306-40615-2",
            "ISBN: 0 306\n40615 2",
            "ISBN: 0- 306-40615-2",
        ]:
            with self.subTest(text=text):
                state = source_state(text)
                before = copy.deepcopy(state.blocks)
                claims = identifiers(printed_metadata(state, None))
                expected = "9780000000002" if "978" in text else "0306406152"
                self.assertEqual(
                    [(expected, "accepted")], [(c["value"], c["status"]) for c in claims]
                )
                self.assertEqual(state.blocks[1]["evidence"], claims[0]["evidence"])
                self.assertEqual(before, state.blocks)
        for text in [
            "ISBN arbitrary narrative words 0306406152",
            "ISBN (edition 2004): 0306406152",
            "ISBN: 0306406152- 77",
            "ISBN: 0306406152\n7",
            "ISBN: 0306406152 2004 7",
        ]:
            with self.subTest(text=text):
                self.assertFalse(identifiers(printed_metadata(source_state(text), None)))

    def test_bounded_plain_label_descriptors_preserve_printed_and_info_candidates(self):
        for text in [
            "ISBN paperback: 9780000000002",
            "Printed ISBN test claim: 9780000000002",
            "ISBN test claim 9780000000002",
        ]:
            with self.subTest(text=text):
                state = source_state(text, False)
                before = copy.deepcopy(state.blocks)
                claims = identifiers(printed_metadata(state, None))
                self.assertEqual(
                    [(ISBN13, "candidate")], [(c["value"], c["status"]) for c in claims]
                )
                self.assertEqual(state.blocks[-1]["evidence"], claims[0]["evidence"])
                self.assertEqual(before, state.blocks)
        front = identifiers(printed_metadata(source_state("ISBN paperback: 9780000000002"), None))
        self.assertEqual([(ISBN13, "accepted")], [(c["value"], c["status"]) for c in front])
        for text in [
            "ISBN arbitrary narrative words 9780000000002",
            "ISBN unboundedlongdescriptor: 9780000000002",
            "ISBN Kit claim: 9780000000002",
            "ISBN test claim: 9780000000003",
            "ISBN test claim: 9780000000002-77",
        ]:
            with self.subTest(text=text):
                self.assertFalse(identifiers(printed_metadata(source_state(text), None)))
        state = source_state("Printed ISBN test claim: 9780000000002", False)
        info = SimpleNamespace(author=None, title=None, subject="ISBN test claim 9780000000019")
        with patch(
            "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
            return_value=SimpleNamespace(metadata=info),
        ):
            claims = identifiers(assemble_metadata(Path("unused.pdf"), state, "conversion"))
        self.assertEqual(
            {("9780000000002", "candidate"), ("9780000000019", "candidate")},
            {(c["value"], c["status"]) for c in claims},
        )

    def test_standalone_bare_and_explicit_x_checksum(self):
        for text, value in [("0 306 40615 2", "0306406152"), ("ISBN 080442957x", "080442957X")]:
            with self.subTest(text=text):
                claims = identifiers(printed_metadata(source_state(text), None))
                self.assertEqual([value], [c["value"] for c in claims])
                self.assertTrue(all(c["status"] == "candidate" for c in claims))

    def test_bare_isbn13_is_one_token_when_its_suffix_is_also_checksummed(self):
        state = source_state("River Press 2004 978-1000000184")
        claims = printed_metadata(state, None)
        self.assertEqual(["9781000000184"], [c["value"] for c in identifiers(claims)])
        self.assertEqual(["candidate"], [c["status"] for c in identifiers(claims)])
        self.assertEqual(["2004"], [c["value"] for c in claims if c["field"] == "date"])

    def test_checksum_partial_numeric_and_non_isbn_prefix_refuse(self):
        for text in [
            "ISBN 0306406153",
            "ISBN 9780000000003",
            "ISBN 97800000000020",
            "ISBN 0306406152-77",
            "ISBN 0306406152 7",
            "ISBN 0000000000000",
        ]:
            with self.subTest(text=text):
                self.assertFalse(identifiers(printed_metadata(source_state(text), None)))

    def test_no_body_year_phone_order_or_quote_promotion(self):
        for text in [
            f"River Press 2004 {ISBN10}",
            f"Telephone: {ISBN10}",
            f"Call {ISBN10}",
            "Order: 9780000000002",
            "She recalled 2004.",
        ]:
            for front in [False, True]:
                if text.startswith("River") and front:
                    continue
                with self.subTest(text=text, front=front):
                    claims = printed_metadata(source_state(text, front), None)
                    self.assertFalse(identifiers(claims))
                    self.assertFalse(any(c["field"] == "date" for c in claims))
        state = metadata_state([title(), dict(kind="quote", text=f"ISBN {ISBN10}"), body()])
        self.assertFalse(identifiers(printed_metadata(state, None)))

    def test_explicit_body_is_candidate_and_other_label_anchoring_stays(self):
        claims = printed_metadata(source_state(f"She cited ISBN {ISBN13}", False), None)
        self.assertEqual(["candidate"], [c["status"] for c in identifiers(claims)])
        claims = printed_metadata(
            source_state('She read "Publisher: Fictional" in a letter.'), None
        )
        self.assertFalse(any(c["field"] == "publisher" for c in claims))

    def test_duplicate_info_candidate_keeps_printed_evidence_without_promotion(self):
        state = source_state(f"The Guide / River Press 2004 {ISBN10}")
        info = SimpleNamespace(author=None, title=None, subject=f"ISBN {ISBN10}")
        with patch(
            "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
            return_value=SimpleNamespace(metadata=info),
        ):
            claims = assemble_metadata(Path("unused.pdf"), state, "new-conversion")
        result = identifiers(claims)
        self.assertEqual(1, len(result))
        self.assertEqual("candidate", result[0]["status"])
        self.assertIn(state.blocks[1]["evidence"][0], result[0]["evidence"])
        self.assertEqual("urn:ava:new-conversion", claims[0]["value"])

    def test_bare_record_does_not_overwrite_competing_accepted_publisher_date(self):
        state = metadata_state(
            [
                title(),
                paragraph("Cover Press"),
                paragraph("Publication date: 2020-01-01"),
                paragraph(f"The Guide / River Press 2004 {ISBN10}", page=2),
                body(),
            ]
        )
        state.bibliographic_roles["observed-1"] = ("publisher", "Cover Press")
        claims = printed_metadata(state, None)
        accepted = [(c["field"], c["value"]) for c in claims if c["status"] == "accepted"]
        self.assertIn(("publisher", "Cover Press"), accepted)
        self.assertIn(("date", "2020-01-01"), accepted)
        self.assertNotIn(("date", "2004"), accepted)
        self.assertNotIn(("publisher", "River Press"), accepted)
        self.assertEqual(
            [("2004", "candidate")],
            [
                (c["value"], c["status"])
                for c in claims
                if c["field"] == "date" and c["value"] == "2004"
            ],
        )

    def test_attached_year_and_long_record_do_not_enable_bare_discovery(self):
        for text in [
            f"Press2004 {ISBN10}",
            f"Книга2004 {ISBN10}",
            "A long narrative " * 20 + f"2004 {ISBN10}",
        ]:
            with self.subTest(text=text):
                claims = printed_metadata(source_state(text), None)
                self.assertFalse(identifiers(claims))
                self.assertFalse(any(c["field"] == "date" for c in claims))

    def test_scope_or_scheme_difference_does_not_collapse_claims(self):
        state = source_state(f"The Guide / River Press 2004 {ISBN10}")
        info = SimpleNamespace(author=None, title=None, subject=f"ISBN {ISBN10}")
        for scope, scheme in [("work", "isbn"), ("source_edition", "other")]:
            with self.subTest(scope=scope, scheme=scheme):
                claim = dict(
                    field="identifier",
                    value="0306406152",
                    identifier_scheme=scheme,
                    scope=scope,
                    status="candidate",
                    origin="source",
                    evidence=state.blocks[1]["evidence"],
                )
                with (
                    patch(
                        "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
                        return_value=SimpleNamespace(metadata=info),
                    ),
                    patch(
                        "ava_pdf_epub.reconstruction_v2.assemble_metadata.printed_metadata",
                        return_value=[claim],
                    ),
                ):
                    claims = assemble_metadata(Path("unused.pdf"), state, "new-conversion")
                self.assertEqual(
                    2,
                    sum(c["field"] == "identifier" and c["scope"] != "conversion" for c in claims),
                )

    def test_candidates_survive_epub_reimport_but_do_not_enter_accepted_opf(self):
        book, assets, _ = fixture()
        claims = printed_metadata(source_state(f"The Guide / River Press 2004 {ISBN10}"), None)
        additions = []
        for index, claim in enumerate(claims):
            if claim["field"] in {"identifier", "date"}:
                additions.append(
                    dict(
                        claim,
                        id=f"candidate-{index}",
                        evidence=[book.blocks[0].evidence[0].model_dump()],
                    )
                )
        self.assertEqual(2, len(additions))
        raw = book.model_dump()
        raw["metadata"] += additions
        changed = CanonicalBookV2.model_validate(raw)
        data = export_epub(changed, assets)
        with ZipFile(io.BytesIO(data)) as archive:
            name = next(n for n in archive.namelist() if n.endswith(".opf"))
            opf = ET.fromstring(archive.read(name))
            metadata = opf.find("{http://www.idpf.org/2007/opf}metadata")
            values = [e.text for e in metadata]
            self.assertNotIn("2004", values)
            self.assertNotIn("0306406152", values)
            self.assertEqual(
                book.metadata[0].value,
                metadata.find("{http://purl.org/dc/elements/1.1/}identifier").text,
            )
        imported, _ = portable_epub(data)
        self.assertEqual(changed, imported)
