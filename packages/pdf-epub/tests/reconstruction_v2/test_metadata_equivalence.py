"""Equivalent printed credits are one fact; uncertainty and distinct identities survive."""

import copy
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata

from .metadata_helpers import body, metadata_state


def claim(field, value, page, **extra):
    return dict(
        field=field,
        value=value,
        status="accepted",
        origin="source",
        scope="work",
        evidence=[dict(page=page, region_id=f"region-{page}", method="native")],
        **extra,
    )


def compiled(values, policy="ava-frontmatter-title-1"):
    state = metadata_state([body()])
    state.source_title_policy = policy
    before = copy.deepcopy(state)
    with (
        patch(
            "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
            return_value=SimpleNamespace(metadata=None),
        ),
        patch(
            "ava_pdf_epub.reconstruction_v2.assemble_metadata.printed_metadata", return_value=values
        ),
    ):
        result = assemble_metadata(Path("authored-unused.pdf"), state, "fixed")
    assert state == before
    return result[1:]


class MetadataEquivalenceTests(unittest.TestCase):
    def test_case_and_whitespace_duplicates_keep_all_source_evidence(self):
        values = [
            claim("contributor", "A. WRITER", 1, contributor_role="author"),
            claim("contributor", "A.   Writer", 4, contributor_role="author"),
            claim("publisher", "EXAMPLE PRESS", 4),
            claim("publisher", "Example Press", 5),
        ]
        before = copy.deepcopy(values)
        result = compiled(values)
        self.assertEqual(len(result), 2)
        self.assertEqual([e["page"] for e in result[0]["evidence"]], [1, 4])
        self.assertEqual([e["page"] for e in result[1]["evidence"]], [4, 5])
        self.assertEqual(values, before)

    def test_uncertain_roles_scopes_schemes_and_origins_remain_distinct(self):
        base = claim("contributor", "A. Writer", 1, contributor_role="author")
        values = [
            base,
            base | dict(value="A. WRITER", status="candidate"),
            base | dict(value="A. WRITER", status="conflict"),
            base | dict(value="A. WRITER", contributor_role="translator"),
            base | dict(value="A. WRITER", scope="source_edition"),
            base | dict(value="A. WRITER", origin="user"),
            claim("identifier", "urn:EXAMPLE:A", 1, identifier_scheme="uri"),
            claim("identifier", "urn:example:a", 2, identifier_scheme="uri"),
        ]
        self.assertEqual(len(compiled(values)), len(values))

    def test_punctuation_accents_initials_and_case_expansion_are_not_equivalent(self):
        values = [
            claim("publisher", value, i + 1)
            for i, value in enumerate(
                [
                    "Masse",
                    "Maße",
                    "Cafe",
                    "Café",
                    "A Writer",
                    "A. Writer",
                    "İ",
                    "i̇",
                    "É",
                    "É",
                    "ﬀ",
                    "FF",
                ]
            )
        ]
        self.assertEqual(len(compiled(values)), len(values))

    def test_legacy_assembly_does_not_change(self):
        values = [claim("publisher", "EXAMPLE", 1), claim("publisher", "Example", 2)]
        self.assertEqual(len(compiled(values, None)), 2)
