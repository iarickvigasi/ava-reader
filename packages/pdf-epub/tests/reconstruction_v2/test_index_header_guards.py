"""Incomplete, semantic, duplicate or changed-route cohorts cannot remove content."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .index_header_guard_fixture import guard_case, unchanged


class IndexHeaderGuards(unittest.TestCase):
    def test_semantic_span_content_role_and_competing_owner_preserve_the_cohort(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, original = guard_case(Path(directory))
            header = next(s for s in original[4] if s.kind == "heading")
            changes = [
                {"text": "General Index"},
                {"kind": "paragraph"},
                {"chapter_start": True},
                {"related_to": "different-owner"},
                *(
                    {"spans": [ObservedSpan(start=0, end=7, **v)]}
                    for v in [
                        {"url": "https://example.org"},
                        {"note_label": "1"},
                        {"target_text": "note"},
                    ]
                ),
            ]
            for update in changes:
                owners = {
                    **original,
                    4: [
                        s.model_copy(update=update) if s.id == header.id else s for s in original[4]
                    ],
                }
                with self.subTest(update=update):
                    self.assertTrue(unchanged(source, pages, owners))
            duplicate = header.model_copy(update={"id": header.id.rsplit("-", 1)[0] + "-9999"})
            self.assertTrue(unchanged(source, pages, {**original, 4: [*original[4], duplicate]}))

    def test_missing_peer_short_mixed_parity_and_stale_source_have_no_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, owners = guard_case(Path(directory))
            self.assertTrue(
                unchanged(source, pages[:2], {n: v for n, v in owners.items() if n in {2, 4}})
            )
            no_peer = {
                n: [
                    s.model_copy(update={"kind": "heading", "heading_level": 2})
                    if s.kind == "furniture"
                    else s
                    for s in v
                ]
                for n, v in owners.items()
            }
            self.assertTrue(unchanged(source, pages, no_peer))
            stale = [
                p.model_copy(
                    update={
                        "source_sha256": "a" * 64,
                        "tasks": [
                            t.model_copy(update={"source_sha256": "a" * 64}) for t in p.tasks
                        ],
                    }
                )
                for p in pages
            ]
            self.assertTrue(unchanged(source, stale, owners))
            checkpoint = pages[1]
            for update in [
                {"tasks": []},
                {
                    "observation": checkpoint.observation.model_copy(
                        update={"risks": [*checkpoint.observation.risks, "unknown"]}
                    )
                },
            ]:
                self.assertTrue(
                    unchanged(
                        source, [pages[0], checkpoint.model_copy(update=update), pages[2]], owners
                    )
                )
