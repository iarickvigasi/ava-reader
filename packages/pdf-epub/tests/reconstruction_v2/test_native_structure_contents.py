"""Current carriers need assembled source offsets, including ordinary pages without TOC rows."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.native_contents_claims import native_contents_claims
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.qualify_native_structure import qualify_native_structure
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .native_structure_decision_fixture import line, response
from .native_structure_routing_fixture import checkpoint, stored


class NativeStructureContentsTests(unittest.TestCase):
    def test_current_plain_page_has_no_spurious_contents_policy_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = stored(
                scratch, [checkpoint(scratch, [line("p1-body", "Ordinary prose.", y=120)])]
            )
            qualify_native_structure(pages, scratch, "ava-native-structure-1")
            self.assertEqual(native_contents_claims(pages, []), [])

    def test_contents_use_current_group_owner_map_not_predecision_maps(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            lines = [
                line("p1-prefix", "Opening prose.", y=120),
                line("p1-row", "Chapter One 12", y=140),
            ]
            pages = stored(scratch, [checkpoint(scratch, lines)])
            qualify_native_structure(pages, scratch, "ava-native-structure-1")
            page = pages[0]
            self.assertEqual(page.native_line_maps, [])
            task = page.tasks[0]
            answer = response(
                task,
                [
                    dict(
                        id="group",
                        region_id=task.regions[0].source.id,
                        line_ids=[item.id for item in lines],
                        kind="paragraph",
                    )
                ],
            )
            assembled = assemble_native_structure_source(task, answer, page.observation)
            row = Segment(
                id="p1-row",
                page=1,
                box=lines[1].box,
                text=lines[1].text,
                kind="paragraph",
                method="native",
                native_line_ids=["p1-row"],
            )
            with patch(
                "ava_pdf_epub.reconstruction_v2.native_contents_claims.native_contents_rows",
                return_value=([row], {row.id}),
            ):
                with self.assertRaisesRegex(ValueError, "assembled source line maps"):
                    native_contents_claims(pages, list(assembled.segments))
                claims = native_contents_claims(
                    pages, list(assembled.segments), {m.line_id: m for m in assembled.line_maps}
                )
            self.assertEqual(len(claims), 1)
            self.assertEqual(claims[0].title, "Chapter One")
            self.assertEqual(claims[0].source_id, assembled.segments[0].id)
            self.assertEqual(claims[0].source_offset, len("Opening prose. "))
