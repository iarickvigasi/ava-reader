"""Reject stale/corrupt render and task geometry instead of attaching invented title evidence."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.printed_title_contract import PrintedTitleTask
from ava_pdf_epub.reconstruction_v2.printed_title_task import printed_title_task
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier

from .printed_title_fixture import title_fixture


class PrintedTitleIntegrityTests(unittest.TestCase):
    def test_task_full_text_crop_render_and_image_changes_refuse_even_with_a_fresh_task_id(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, _, _ = title_fixture(Path(directory))
            for change in ["text", "foreign_crop", "source_box", "render", "image", "dimensions"]:
                with self.subTest(change=change):
                    raw = task.model_dump(mode="json")
                    if change == "text":
                        raw["node"]["text"] += " invented"
                    elif change == "foreign_crop":
                        raw["crops"][0]["node_id"] = "foreign-node"
                    elif change == "source_box":
                        raw["crops"][0]["source_box"]["x0"] += 1
                    elif change == "render":
                        raw["crops"][0]["render_sha256"] = "f" * 64
                    elif change == "image":
                        raw["image"]["base64"] = "Y29ycnVwdA=="
                    else:
                        raw["image"]["height"] += 1
                    raw["task_id"] = refinement_identifier(raw)
                    with self.assertRaises(ValueError):
                        PrintedTitleTask.model_validate(raw)

    def test_task_preparation_rechecks_original_render_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            task, prepared, segments, _ = title_fixture(scratch)
            (scratch / "page.png").write_bytes(b"changed private render")
            with self.assertRaisesRegex(ValueError, "render is stale"):
                printed_title_task(
                    segments,
                    {1: prepared},
                    scratch,
                    task.source_sha256,
                    observation_digest(segments),
                )
