"""Source identity failures must stop before invoking a native OCR process."""

import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.annotation_word_ocr import _run_ocr, recognize_annotation_words
from ava_pdf_epub.reconstruction_v2.annotation_words import ERROR, HEADER
from ava_pdf_epub.reconstruction_v2.observations import PageObservation


class AnnotationWordOcrTests(unittest.TestCase):
    def observation(self, path):
        return PageObservation(
            number=1,
            width_pt=300,
            height_pt=400,
            rotation=0,
            render_path=path.name,
            render_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            render_width=600,
            render_height=800,
            lines=[],
            graphics=[],
            risks=[],
        )

    def test_source_hash_and_dimensions_gate_native_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            path = scratch / "render.png"
            Image.new("RGB", (600, 800), "white").save(path)
            page = self.observation(path)
            for changed in [
                page.model_copy(update={"render_sha256": "f" * 64}),
                page.model_copy(update={"render_width": 599}),
            ]:
                with patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr") as run:
                    with self.assertRaisesRegex(ValueError, ERROR):
                        recognize_annotation_words(changed, scratch)
                    run.assert_not_called()

    def test_private_word_view_keeps_measured_density_and_exact_pixels(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            path = scratch / "render.png"
            original = Image.new("RGB", (600, 800), "white")
            original.paste("black", (20, 40, 30, 60))
            # Source-render geometry wins over arbitrary or missing PNG metadata.
            original.save(path, dpi=(999, 999))

            def inspect_view(image, languages):
                self.assertEqual("eng", languages)
                with Image.open(image) as view:
                    self.assertAlmostEqual(144, view.info["dpi"][0], delta=0.02)
                    self.assertAlmostEqual(144, view.info["dpi"][1], delta=0.02)
                    self.assertEqual(original.tobytes(), view.convert("RGB").tobytes())
                return ("\t".join(HEADER) + "\n").encode()

            with patch(
                "ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr",
                side_effect=inspect_view,
            ) as run:
                self.assertEqual([], recognize_annotation_words(self.observation(path), scratch))
                self.assertEqual(1, run.call_count)

    def test_profile_binds_local_languages_without_english_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            path = scratch / "render.png"
            Image.new("RGB", (600, 800), "white").save(path)
            page = self.observation(path)
            for profile, expected in [(LEGACY_PROFILE, "eng"), (BILINGUAL_PROFILE, "eng+ukr")]:
                with patch(
                    "ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr",
                    return_value=("\t".join(HEADER) + "\n").encode(),
                ) as run:
                    self.assertEqual(
                        [], recognize_annotation_words(page, scratch, profile_id=profile)
                    )
                    self.assertEqual(expected, run.call_args.args[1])
            with patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr") as run:
                with self.assertRaisesRegex(ValueError, ERROR):
                    recognize_annotation_words(page, scratch, profile_id="unregistered-profile")
                run.assert_not_called()

    def test_outside_scratch_symlink_is_not_read_or_executed(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            scratch = Path(directory)
            path = Path(outside) / "private.png"
            Image.new("RGB", (600, 800), "white").save(path)
            (scratch / path.name).symlink_to(path)
            with patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr") as run:
                with self.assertRaisesRegex(ValueError, ERROR):
                    recognize_annotation_words(self.observation(path), scratch)
                run.assert_not_called()


class AnnotationOcrProcessBoundsTests(unittest.TestCase):
    def execute_child(self, script, timeout=20, limit=4 * 1024 * 1024):
        native_popen = subprocess.Popen
        children = []

        def start(_command, **options):
            child = native_popen([sys.executable, "-c", script], **options)
            children.append(child)
            return child

        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.annotation_word_ocr.subprocess.Popen",
                side_effect=start,
            ),
            patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr.TIMEOUT_SECONDS", timeout),
            patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr.MAX_BYTES", limit),
        ):
            with self.assertRaisesRegex(ValueError, "^" + ERROR + "$"):
                _run_ocr(Path("unused.png"))
        self.assertEqual(1, len(children))
        self.assertIsNotNone(children[0].poll())
        self.assertTrue(children[0].stdout.closed)

    def test_native_command_uses_only_the_fixed_language_inventory(self):
        native_popen = subprocess.Popen
        commands = []

        def start(command, **options):
            commands.append(command)
            return native_popen([sys.executable, "-c", "print('ok')"], **options)

        with patch(
            "ava_pdf_epub.reconstruction_v2.annotation_word_ocr.subprocess.Popen",
            side_effect=start,
        ):
            for language in ["eng", "eng+ukr"]:
                self.assertEqual(b"ok\n", _run_ocr(Path("unused.png"), language))
                self.assertEqual(language, commands[-1][commands[-1].index("-l") + 1])
            with self.assertRaisesRegex(ValueError, ERROR):
                _run_ocr(Path("unused.png"), "rus")
        self.assertEqual(2, len(commands))

    def test_timeout_reaps_native_child_without_exposing_diagnostics(self):
        self.execute_child("import time; time.sleep(10)", timeout=0.05)

    def test_excess_output_stops_native_child(self):
        self.execute_child("import os,time; os.write(1,b'x'*4096); time.sleep(10)", limit=1024)

    def test_failure_does_not_disclose_native_stderr(self):
        self.execute_child("import sys; sys.stderr.write('private source text'); sys.exit(3)")
