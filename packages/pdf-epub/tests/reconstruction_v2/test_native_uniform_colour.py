"""Real authored source preparation; uniform paint is explicit and old routes stay held."""

import copy
import hashlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.native_colour_witness import colours, digest
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.native_review import NativeReviewRequired
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.prepared_native_layout import NativeLayoutPreparedPage
from ava_pdf_epub.reconstruction_v2.qualify_pages import qualify_pages
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from tests.reconstruction_v2.native_colour_fixture import colour_document


class NativeUniformColourTests(unittest.TestCase):
    def prepare(self, *, policy=None, mixed=False, unsafe=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = colour_document(root / "source.pdf", mixed=mixed, unsafe=unsafe)
        self.source, self.scratch = source, root / "scratch"
        return prepare_source(
            source,
            root / "scratch",
            hashlib.sha256(source.read_bytes()).hexdigest(),
            BILINGUAL_PROFILE,
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=policy,
        )

    def test_explicit_uniform_source_ink_is_witness_bound_before_checkpoint(self):
        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        self.assertTrue(all(not p.tasks for p in pages))
        for page in pages:
            self.assertIsNotNone(page.native_colour_witness)
            for line in page.observation.lines:
                for glyph in line.glyphs:
                    self.assertEqual("#231f20", glyph.paint_ink_color)
                    self.assertEqual("#231f20", glyph.paint_color)
            self.assertTrue(any(s.text == "* * *" for s in page.native_segments))

    def test_no_layout_policy_retains_prior_unknown_paint_tasks(self):
        pages = self.prepare()
        self.assertTrue(all(p.tasks for p in pages))
        self.assertTrue(
            all(
                g.paint_ink_color is None
                for p in pages
                for line in p.observation.lines
                for g in line.glyphs
            )
        )

    def test_mixed_source_paint_does_not_acquire_uniform_witness(self):
        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY, mixed=True)
        self.assertTrue(all(p.tasks for p in pages))
        self.assertTrue(all(getattr(p, "native_colour_witness", None) is None for p in pages))

    def test_valid_witness_cannot_authorize_forged_glyph_or_style(self):
        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        for path in ("ink", "display", "line", "segment", "span"):
            raw = pages[0].model_dump()
            if path == "ink":
                raw["observation"]["lines"][0]["glyphs"][0]["paint_ink_color"] = "#abcdef"
            elif path == "display":
                raw["observation"]["lines"][0]["glyphs"][0]["paint_color"] = "#abcdef"
            elif path == "line":
                raw["observation"]["lines"][0]["style"]["color"] = "#abcdef"
            elif path == "segment":
                raw["native_segments"][0]["style"]["color"] = "#abcdef"
            else:
                raw["native_segments"][0]["spans"][0]["style"]["color"] = "#abcdef"
            with self.subTest(field=path), self.assertRaisesRegex(ValueError, "overlay"):
                NativeLayoutPreparedPage.model_validate(raw)

    def test_final_source_recompute_rejects_renewed_forged_overlay_without_render(self):
        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        raw = pages[0].model_dump()

        def forge(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if key in {"color", "paint_color", "paint_ink_color"}:
                        value[key] = "#abcdef"
                    else:
                        forge(item)
            elif isinstance(value, list):
                for item in value:
                    forge(item)

        forge(raw["observation"])
        forge(raw["native_segments"])
        raw["native_colour_witness"]["rgb"] = [171, 205, 239]
        candidate = pages[0].model_copy(
            update={
                "observation": type(pages[0].observation).model_validate(raw["observation"]),
                "native_segments": [
                    type(pages[0].native_segments[0]).model_validate(v)
                    for v in raw["native_segments"]
                ],
            }
        )
        raw["native_colour_witness"]["observation_overlay_sha256"] = digest(
            colours(candidate.observation)
        )
        raw["native_colour_witness"]["segment_overlay_sha256"] = digest(
            [colours(s) for s in candidate.native_segments]
        )
        forged = NativeLayoutPreparedPage.model_validate(raw)
        with patch(
            "ava_pdf_epub.reconstruction_v2.observe_page.render_page",
            side_effect=AssertionError("RECOMPUTATION_RENDERED"),
        ):
            with self.assertRaisesRegex(ValueError, "reproduce"):
                qualify_pages(
                    self.source,
                    self.scratch,
                    [forged, *pages[1:]],
                    [],
                    source_layout_policy=NATIVE_LAYOUT_POLICY,
                    source_line_maps={},
                )

    def test_erasing_whole_witness_and_inferred_colours_cannot_keep_zero_tasks(self):
        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        raw = pages[0].model_dump()
        raw.pop("native_colour_witness")

        def erase(value):
            if isinstance(value, dict):
                for key in list(value):
                    if key in {"color", "paint_color", "paint_ink_color"}:
                        value.pop(key)
                    else:
                        erase(value[key])
            elif isinstance(value, list):
                for item in value:
                    erase(item)

        erase(raw)
        erased = NativeLayoutPreparedPage.model_validate(raw)
        self.assertFalse(erased.tasks)
        with patch(
            "ava_pdf_epub.reconstruction_v2.observe_page.render_page",
            side_effect=AssertionError("RECOMPUTATION_RENDERED"),
        ):
            with self.assertRaisesRegex(ValueError, "reproduce"):
                qualify_pages(
                    self.source,
                    self.scratch,
                    [erased, *pages[1:]],
                    [],
                    source_layout_policy=NATIVE_LAYOUT_POLICY,
                    source_line_maps={},
                )

    def test_erased_witness_retained_colours_refuse_when_optional_tool_disappears(self):
        from ava_pdf_epub.reconstruction_v2.native_colour_validate import verify_source_colours

        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        erased = []
        for page in pages:
            raw = page.model_dump()
            raw.pop("native_colour_witness")
            erased.append(NativeLayoutPreparedPage.model_validate(raw))
        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.native_colour_capture.uniform_objects",
                return_value=None,
            ),
            patch(
                "ava_pdf_epub.reconstruction_v2.observe_page.render_page",
                side_effect=AssertionError("RECOMPUTATION_RENDERED"),
            ),
            self.assertRaisesRegex(ValueError, "reproduce"),
        ):
            verify_source_colours(self.source, self.scratch, erased, set())

    def test_unchanged_device_colours_without_witness_reproduce_without_optional_tool(self):
        from ava_pdf_epub.reconstruction_v2.furniture import furniture_ids
        from ava_pdf_epub.reconstruction_v2.native_colour_validate import verify_source_colours
        from tests.reconstruction_v2.native_layout_fixture import document

        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = document(root / "ordinary.pdf")
        for policy in (None, NATIVE_LAYOUT_POLICY):
            scratch = root / ("layout" if policy else "default")
            with patch(
                "ava_pdf_epub.reconstruction_v2.native_colour_capture.uniform_objects",
                side_effect=AssertionError("DEVICE_SOURCE_USED_OPTIONAL_TOOL"),
            ):
                pages = prepare_source(
                    source,
                    scratch,
                    hashlib.sha256(source.read_bytes()).hexdigest(),
                    BILINGUAL_PROFILE,
                    source_feature_policy=FEATURE_POLICY,
                    source_layout_policy=policy,
                )
                self.assertTrue(
                    all(getattr(p, "native_colour_witness", None) is None for p in pages)
                )
                if policy is not None:
                    verify_source_colours(
                        source,
                        scratch,
                        pages,
                        furniture_ids((p.observation for p in pages), BILINGUAL_PROFILE),
                    )

    def test_tables_only_mutation_cannot_reuse_valid_source_witness(self):
        from ava_pdf_epub.reconstruction_v2.native_colour_validate import verify_source_colours

        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        raw = pages[0].model_dump()
        self.assertEqual([], raw["tables"])
        line = raw["observation"]["lines"][0]
        raw["tables"] = [{"box": line["box"], "cells": [[line["box"]]], "line_ids": [line["id"]]}]
        changed = NativeLayoutPreparedPage.model_validate(raw)
        self.assertEqual(pages[0].observation, changed.observation)
        self.assertEqual(pages[0].native_colour_witness, changed.native_colour_witness)
        with self.assertRaisesRegex(ValueError, "reproduce"):
            verify_source_colours(self.source, self.scratch, [changed, *pages[1:]], set())

    def test_unchanged_witness_source_and_overlay_reproduce_without_render(self):
        pages = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        with patch(
            "ava_pdf_epub.reconstruction_v2.observe_page.render_page",
            side_effect=AssertionError("RECOMPUTATION_RENDERED"),
        ):
            output = qualify_pages(
                self.source,
                self.scratch,
                pages,
                [],
                source_layout_policy=NATIVE_LAYOUT_POLICY,
                source_line_maps={},
            )
        self.assertEqual(len(pages), len(output))

    def test_missing_tool_keeps_ordinary_unknown_route_but_refuses_erased_zero_task_route(self):
        from ava_pdf_epub.reconstruction_v2.native_colour_validate import verify_source_colours

        positive = self.prepare(policy=NATIVE_LAYOUT_POLICY)
        erased = []
        for page in positive:
            raw = page.model_dump()
            raw.pop("native_colour_witness")

            def erase(value):
                if isinstance(value, dict):
                    for key in list(value):
                        if key in {"color", "paint_color", "paint_ink_color"}:
                            value.pop(key)
                        else:
                            erase(value[key])
                elif isinstance(value, list):
                    for item in value:
                        erase(item)

            erase(raw)
            erased.append(NativeLayoutPreparedPage.model_validate(raw))
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_colour_capture.uniform_objects",
            return_value=None,
        ):
            with self.assertRaisesRegex(ValueError, "reproduce"):
                verify_source_colours(self.source, self.scratch, erased, set())
            ordinary = self.prepare(policy=NATIVE_LAYOUT_POLICY)
            self.assertTrue(all(p.tasks and p.native_colour_witness is None for p in ordinary))
            verify_source_colours(self.source, self.scratch, ordinary, set())

    def test_tool_identity_rehashes_current_files_and_proof_refuses_mid_read_change(self):
        from ava_pdf_epub.reconstruction_v2.native_colour_pdfium import (
            tool_identity,
            uniform_objects,
        )

        with patch("pathlib.Path.read_bytes", return_value=b"AUTHORED_TOOL_EPOCH_ONE"):
            first = tool_identity()
        with patch("pathlib.Path.read_bytes", return_value=b"AUTHORED_TOOL_EPOCH_TWO"):
            second = tool_identity()
        self.assertNotEqual(first, second)
        self.prepare()
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_colour_pdfium.tool_identity",
            side_effect=["1" * 64, "2" * 64],
        ) as identity:
            self.assertIsNone(
                uniform_objects(self.source, 1, (35, 31, 32), [0.0, 0.0, 346.0, 582.0])
            )
        self.assertEqual(2, identity.call_count)

    def test_public_schema_default_and_missing_optional_tools_remain_importable(self):
        self.prepare()
        script = r"""
import importlib.abc, sys
class Missing(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.startswith('pypdfium2') or fullname == 'PIL.ImageCms':
            raise ImportError('AUTHORED_OPTIONAL_TOOL_UNAVAILABLE')
sys.meta_path.insert(0, Missing())
from pathlib import Path
from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
import hashlib
source=Path(sys.argv[1]);scratch=Path(sys.argv[2])
for policy in [None,NATIVE_LAYOUT_POLICY]:
    pages=prepare_source(
        source,scratch / ('new' if policy else 'old'),
        hashlib.sha256(source.read_bytes()).hexdigest(),
        BILINGUAL_PROFILE,source_feature_policy=FEATURE_POLICY,source_layout_policy=policy)
    assert all(p.tasks for p in pages)
    assert all(getattr(p,'native_colour_witness',None) is None for p in pages)
print('PASS_OPTIONAL_TOOL_REFUSAL_AND_DEFAULT_IMPORT')
"""
        result = subprocess.run(
            [sys.executable, "-c", script, str(self.source), str(self.scratch / "unavailable")],
            capture_output=True,
            text=True,
            env=os.environ.copy(),
            timeout=30,
        )
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("PASS_OPTIONAL_TOOL_REFUSAL", result.stdout)

    def test_source_visibility_profile_and_frame_fail_closed(self):
        for unsafe in ("opacity", "clip", "hidden", "rotate", "offset", "profile"):
            with self.subTest(condition=unsafe):
                try:
                    pages = self.prepare(policy=NATIVE_LAYOUT_POLICY, unsafe=unsafe)
                except NativeReviewRequired:
                    self.assertIn(unsafe, {"opacity", "clip"})
                    continue  # Existing layout review is an explicit refusal, not colour success.
                self.assertTrue(
                    all(getattr(p, "native_colour_witness", None) is None for p in pages)
                )
                if unsafe not in {"opacity", "hidden"}:
                    self.assertTrue(all(p.tasks for p in pages))

    def test_missing_getter_and_source_view_disagreement_refuse(self):
        self.prepare()
        from pypdf import PdfReader

        from ava_pdf_epub.reconstruction_v2.native_colour_capture import colour_capture

        reader = PdfReader(self.source)
        with patch("pypdfium2.raw.FPDFPageObj_GetFillColor", return_value=0):
            self.assertIsNone(
                colour_capture(
                    self.source,
                    1,
                    reader.pages[0],
                    reader,
                    original=reader.pages[0],
                    original_reader=reader,
                )
            )
        original = reader.pages[0]
        different = copy.copy(original)
        from pypdf.generic import NameObject, NumberObject

        different[NameObject("/Rotate")] = NumberObject(90)
        self.assertIsNone(
            colour_capture(
                self.source, 1, original, reader, original=different, original_reader=reader
            )
        )
