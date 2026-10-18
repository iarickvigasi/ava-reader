"""Early uniform proof keeps complete peers and every existing strict join boundary."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.compound_heading_claims import resolve_heading_claims
from ava_pdf_epub.reconstruction_v2.compound_heading_style_update import compound_style_update
from ava_pdf_epub.reconstruction_v2.heading_font_families import corroborate_heading_families
from ava_pdf_epub.reconstruction_v2.ocr_font_faces import corroborate_ocr_font_faces
from ava_pdf_epub.reconstruction_v2.ocr_font_region import corroborated_font_region
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .heading_family_fixture import fixture
from .test_compound_headings import claim, workspace
from .test_ocr_font_runs import TEXT, printed_source


class HeadingFontFamiliesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source, self.prepared, self.items, self.state = fixture(self.root)

    def recover(self, items=None, prepared=None):
        return corroborate_heading_families(
            self.source, [prepared or self.prepared], items or self.items, self.state
        )

    def test_selected_checkpoints_are_fetched_only_as_the_proof_consumes_them(self):
        from types import SimpleNamespace

        events = []
        second = self.items[2].model_copy(update={"id": "second-page", "page": 2})
        peers = [*self.items, second]

        class Pages:
            def __getitem__(self, number):
                events.append(("fetch", number))
                return SimpleNamespace(observation=SimpleNamespace(number=number))

        def consume(source, prepared, items, state, **kwargs):
            # This is a lifetime/iteration contract, not a substitute font proof.
            self.assertEqual([], events)
            self.assertIs(peers, items)
            for page in prepared:
                events.append(("consume", page.observation.number))
            return items

        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.heading_font_families.PreparedPageMap",
                return_value=Pages(),
            ),
            patch(
                "ava_pdf_epub.reconstruction_v2.heading_font_families.corroborate_ocr_font_faces",
                side_effect=consume,
            ),
        ):
            self.assertIs(peers, corroborate_heading_families(self.source, [], peers, self.state))
        self.assertEqual([("fetch", 1), ("consume", 1), ("fetch", 2), ("consume", 2)], events)

    def test_uniform_source_proof_precedes_join_and_keeps_known_style_corrections(self):
        before = [s.model_dump_json() for s in self.items]
        checkpoint = self.prepared.model_dump_json()
        with self.assertRaisesRegex(ValueError, "unknown component style"):
            resolve_heading_claims(
                [claim("Known opening Visible subtitle")], {}, self.items, self.state
            )
        actual = self.recover()
        self.assertEqual("serif", actual[2].style.family)
        for old, new in zip(self.items, actual, strict=True):
            self.assertEqual(old.model_dump(exclude={"style"}), new.model_dump(exclude={"style"}))
        self.assertEqual(self.items[:2], actual[:2])
        self.assertEqual(before, [s.model_dump_json() for s in self.items])
        self.assertEqual(checkpoint, self.prepared.model_dump_json())
        self.assertEqual(1, len(self.state.structure_findings))
        self.assertEqual(self.items[2].id, self.state.structure_findings[0].block_id)
        self.assertIs(actual, self.recover(items=actual))
        self.assertEqual(1, len(self.state.structure_findings))
        joined, _ = resolve_heading_claims(
            [claim("Known opening Visible subtitle")], {}, actual, self.state
        )
        opening = next(s for s in joined if s.id == self.items[1].id)
        self.assertEqual("Known opening\nVisible subtitle", opening.text)
        updated = compound_style_update(
            opening.model_copy(
                update={"style": opening.style.model_copy(update={"family": "sans-serif"})}
            ),
            self.state,
        )
        self.assertTrue(all(s.style.family == "sans-serif" for s in updated.spans))
        self.assertEqual("serif", self.state.compound_heading_sources[opening.id][1].style.family)

    def test_owner_selection_preserves_complete_peers_and_unselected_owners(self):
        calls = []

        def observed(*args, **kwargs):
            calls.append([s.id for s in args[4]])
            return corroborated_font_region(*args, **kwargs)

        with patch(
            "ava_pdf_epub.reconstruction_v2.ocr_font_faces.corroborated_font_region",
            side_effect=observed,
        ):
            actual = self.recover()
        self.assertEqual([[s.id for s in self.items]], calls)
        self.assertEqual(self.items[:2], actual[:2])
        duplicate = self.items[2].model_copy(update={"id": "competing-owner"})
        peers = [*self.items, duplicate]
        self.state.structure_findings.clear()
        self.assertEqual(peers, self.recover(items=peers))
        self.assertEqual([], self.state.structure_findings)
        with self.assertRaisesRegex(ValueError, "unknown component style"):
            resolve_heading_claims(
                [claim("Known opening Visible subtitle")], {}, self.items, self.state
            )

    def test_changed_text_box_hidden_glyph_unknown_font_and_risks_do_not_recover(self):
        page = self.prepared.observation
        line = page.lines[2]
        updates = [dict(visible=False), dict(font="UnknownFace")]
        pages = [page.model_copy(update={"risks": ["clipped_glyph"]})]
        for update in updates:
            lines = list(page.lines)
            lines[2] = line.model_copy(
                update={"glyphs": [g.model_copy(update=update) for g in line.glyphs]}
            )
            pages.append(page.model_copy(update={"lines": lines}))
        for changed in pages:
            with self.subTest(page=changed):
                self.state.structure_findings.clear()
                self.assertEqual(
                    self.items,
                    self.recover(
                        prepared=self.prepared.model_copy(update={"observation": changed})
                    ),
                )
                self.assertEqual([], self.state.structure_findings)
        for update in [dict(text="Visible subtitlE"), dict(box=self.items[0].box)]:
            items = [*self.items[:2], self.items[2].model_copy(update=update)]
            self.assertEqual(items, self.recover(items=items))
            self.assertEqual([], self.state.structure_findings)

    def test_historical_policies_and_known_families_never_open_source(self):
        for field in ["source_title_policy", "source_continuation_policy"]:
            state = workspace(self.items)
            state.source_continuation_policy = self.state.source_continuation_policy
            setattr(state, field, None)
            with patch(
                "ava_pdf_epub.reconstruction_v2.heading_font_families.corroborate_ocr_font_faces",
                side_effect=AssertionError("Unexpected font proof"),
            ):
                self.assertIs(
                    self.items,
                    corroborate_heading_families(Path("missing.pdf"), [], self.items, state),
                )
        known = [
            s.model_copy(update={"style": s.style.model_copy(update={"family": "serif"})})
            for s in self.items
        ]
        self.assertIs(
            known, corroborate_heading_families(Path("missing.pdf"), [], known, self.state)
        )

    def test_explicit_empty_selection_emits_nothing_and_default_path_stays_available(self):
        self.assertEqual(
            self.items,
            corroborate_ocr_font_faces(
                self.source, [self.prepared], self.items, self.state, uniform_owner_ids=frozenset()
            ),
        )
        self.assertEqual([], self.state.structure_findings)
        result = corroborate_ocr_font_faces(self.source, [self.prepared], self.items, self.state)
        self.assertEqual("serif", result[2].style.family)
        self.assertEqual(3, len(self.state.structure_findings))

    def test_mixed_fonts_are_not_appended_early_and_keep_the_existing_later_path(self):
        printed_source(self.source)
        prepared = prepare_page(self.source, self.root, 1)
        line = next(line for line in prepared.observation.lines if line.text == TEXT)
        item = Segment(
            id="mixed",
            page=1,
            box=line.box,
            kind="heading",
            heading_level=1,
            text=TEXT,
            method="ocr",
            style=Style(id="unknown", relative_size=2),
        )
        items = [item]
        self.assertEqual(items, self.recover(items=items, prepared=prepared))
        self.assertEqual([], self.state.structure_findings)
        self.assertEqual([], item.spans)
        base = self.items[1].model_copy(update={"text": "Opening"})
        with self.assertRaisesRegex(ValueError, "unknown component style"):
            resolve_heading_claims(
                [claim("Opening " + TEXT)], {}, [base, item], workspace([base, item])
            )
        result = corroborate_ocr_font_faces(self.source, [prepared], items, self.state)
        self.assertTrue(result[0].spans)
        self.assertEqual(
            "OCR_DECLARED_FONT_RUNS_CORROBORATED", self.state.structure_findings[0].code
        )
