"""A local resolution retry cannot waive source identity, text or geometry failures."""

import subprocess
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image

from ava_pdf_epub.extract import sha256_file
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_caller_context import (
    NativeCallerLowConfidence,
    native_caller_ranges,
)
from ava_pdf_epub.reconstruction_v2.native_link_resolution import NativeLinkResolution
from ava_pdf_epub.reconstruction_v2.pdf_links import apply_pdf_links
from tests.reconstruction_v2 import test_native_caller_context as fixture


class NativeLinkResolutionTests(unittest.TestCase):
    def setup_fixture(self):
        helper = fixture.NativeCallerContextTests()
        self.addCleanup(helper.doCleanups)
        return helper, helper.fixture()

    def render(self, args, **kwargs):
        self.assertEqual(60, kwargs["timeout"])
        self.assertEqual("4800", args[args.index("-scale-to") + 1])
        Image.new("RGB", (4800, 4800), "white").save(Path(args[-1] + ".png"))
        return SimpleNamespace(returncode=0, stderr=b"")

    def test_confidence_only_classification_requires_all_other_proof(self):
        helper, (root, _, checkpoint, owner, caller) = self.setup_fixture()
        words = helper.word_values()
        low = [replace(words[0], confidence=74), words[1]]
        cases = [
            (low, NativeCallerLowConfidence),
            ([low[0], replace(words[1], text="changed")], ValueError),
            ([low[0], replace(words[1], visible=False)], ValueError),
            ([low[0], replace(words[1], box=fixture.rectangle(40, 30, 70, 45))], ValueError),
        ]
        for observed, expected in cases:
            with (
                self.subTest(expected=expected),
                patch(
                    "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                    return_value=observed,
                ),
            ):
                with self.assertRaises(ValueError) as raised:
                    native_caller_ranges(
                        checkpoint.observation,
                        [owner],
                        caller,
                        root,
                        checkpoint.profile_id,
                        None,
                        {},
                    )
                self.assertIs(type(raised.exception), expected)

    def test_render_source_binding_frame_immutability_cache_and_cleanup(self):
        _, (_, source, checkpoint, _, _) = self.setup_fixture()
        before = checkpoint.model_dump()
        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.native_link_resolution.shutil.which",
                return_value="/usr/bin/pdftoppm",
            ),
            patch(
                "ava_pdf_epub.reconstruction_v2.native_link_resolution.subprocess.run",
                side_effect=self.render,
            ) as render,
        ):
            with NativeLinkResolution(source, checkpoint) as retry:
                page = retry.observation()
                directory = retry.directory
                self.assertEqual(4800, page.render_width)
                self.assertEqual(sha256_file(directory / page.render_path), page.render_sha256)
                self.assertIs(page, retry.observation())
                self.assertEqual(1, render.call_count)
                self.assertEqual(before, checkpoint.model_dump())
            self.assertFalse(directory.exists())
        wrong = checkpoint.model_copy(update={"source_sha256": "0" * 64})
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_link_resolution.subprocess.run"
        ) as render:
            with NativeLinkResolution(source, wrong) as retry, self.assertRaises(ValueError):
                retry.observation()
            render.assert_not_called()

    def test_render_warning_timeout_changed_source_and_wrong_dimensions_refuse(self):
        for mode in ("warning", "timeout", "changed-source", "dimensions"):
            with self.subTest(mode=mode):
                _, (_, source, checkpoint, _, _) = self.setup_fixture()

                def render(args, mode=mode, source=source, **kwargs):
                    if mode == "timeout":
                        raise subprocess.TimeoutExpired(args, 60)
                    result = self.render(args, **kwargs)
                    if mode == "warning":
                        result.stderr = b"render warning"
                    elif mode == "changed-source":
                        source.write_bytes(source.read_bytes() + b"\n")
                    elif mode == "dimensions":
                        Image.new("RGB", (4800, 2400), "white").save(Path(args[-1] + ".png"))
                    return result

                with (
                    patch(
                        "ava_pdf_epub.reconstruction_v2.native_link_resolution.shutil.which",
                        return_value="/usr/bin/pdftoppm",
                    ),
                    patch(
                        "ava_pdf_epub.reconstruction_v2.native_link_resolution.subprocess.run",
                        side_effect=render,
                    ),
                ):
                    with NativeLinkResolution(source, checkpoint) as retry:
                        with self.assertRaises(ValueError):
                            retry.observation()
                        directory = retry.directory
                    self.assertFalse(directory.exists())

    def test_stock_application_retries_once_with_fresh_cache_and_preserves_content(self):
        helper, (root, source, checkpoint, owner, _) = self.setup_fixture()
        words = helper.word_values()
        calls = []

        def recognize(page, line, caller, scratch, profile):
            calls.append((page.render_width, scratch))
            return [replace(w, confidence=74 if page.render_width == 200 else 96) for w in words]

        state = AssemblyState()
        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.native_link_resolution.shutil.which",
                return_value="/usr/bin/pdftoppm",
            ),
            patch(
                "ava_pdf_epub.reconstruction_v2.native_link_resolution.subprocess.run",
                side_effect=self.render,
            ),
            patch(
                "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                side_effect=recognize,
            ),
        ):
            result = apply_pdf_links(source, [checkpoint], [owner], state, root)
        self.assertEqual([200, 4800], [w for w, _ in calls])
        self.assertFalse(calls[1][1].exists())
        self.assertEqual(owner.text, result[0].text)
        self.assertEqual(owner.style, result[0].style)
        self.assertEqual([(8, 18)], [(s.start, s.end) for s in result[0].spans])
        self.assertEqual(
            ["PDF_LINK_HIGH_RESOLUTION_CORROBORATED"], [f.code for f in state.structure_findings]
        )

    def test_second_failure_is_terminal_and_non_confidence_failure_never_renders(self):
        for mode in ("low", "geometry", "second-text"):
            with self.subTest(mode=mode):
                helper, (root, source, checkpoint, owner, _) = self.setup_fixture()
                words = helper.word_values()

                def recognize(page, *_args, mode=mode, words=words):
                    observed = [replace(w, confidence=74) for w in words]
                    if mode == "geometry":
                        observed[-1] = replace(observed[-1], visible=False)
                    if mode == "second-text" and page.render_width == 4800:
                        observed[-1] = replace(observed[-1], text="changed", confidence=99)
                    return observed

                with (
                    patch(
                        "ava_pdf_epub.reconstruction_v2.native_link_resolution.shutil.which",
                        return_value="/usr/bin/pdftoppm",
                    ),
                    patch(
                        "ava_pdf_epub.reconstruction_v2.native_link_resolution.subprocess.run",
                        side_effect=self.render,
                    ) as render,
                    patch(
                        "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                        side_effect=recognize,
                    ) as ocr,
                ):
                    with self.assertRaises(ValueError):
                        apply_pdf_links(source, [checkpoint], [owner], AssemblyState(), root)
                    self.assertEqual(0 if mode == "geometry" else 1, render.call_count)
                    self.assertEqual(1 if mode == "geometry" else 2, ocr.call_count)
