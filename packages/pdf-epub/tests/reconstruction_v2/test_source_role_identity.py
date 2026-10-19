"""Distinct current authority and complete readable source context are mandatory."""

import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import (
    FrontmatterTitleRefinementBatch,
)
from ava_pdf_epub.reconstruction_v2.refinement_contract import (
    PrintedTitleRefinementBatch,
    RefinementBatch,
)
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier
from ava_pdf_epub.reconstruction_v2.source_role_contract import SourceRoleTask
from ava_pdf_epub.reconstruction_v2.source_role_sheet import source_role_sheet

from .source_role_fixture import role_case


class SourceRoleIdentityTests(unittest.TestCase):
    def test_historical_batches_cannot_carry_new_role_task(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, task = role_case(Path(directory))
            for model, version in [
                (RefinementBatch, "ava-book-refinement-batch-1"),
                (PrintedTitleRefinementBatch, "ava-book-refinement-batch-2"),
                (FrontmatterTitleRefinementBatch, "ava-book-refinement-batch-3"),
            ]:
                raw = dict(
                    schema_version=version,
                    source_sha256=task.source_sha256,
                    tasks=[task.model_dump(mode="json")],
                )
                if model is FrontmatterTitleRefinementBatch:
                    raw["source_title_policy"] = "ava-frontmatter-title-1"
                with self.assertRaises(ValidationError):
                    model.model_validate(raw)

    def test_rehashed_crop_or_scale_corruption_does_not_gain_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, task = role_case(Path(directory))
            for mutate in [
                lambda v: v["crops"][0]["source_box"].update(x0=1),
                lambda v: v["crops"][1].update(node_id="other"),
                lambda v: v["crops"][1].update(render_sha256="b" * 64),
                lambda v: v["crops"][1].update(image_box=v["crops"][0]["image_box"]),
                lambda v: v["nodes"][0].update(page=2),
                lambda v: v.update(pixels_per_point=1),
            ]:
                raw = task.model_dump(mode="json")
                mutate(raw)
                raw["task_id"] = refinement_identifier(raw)
                with self.assertRaises(ValueError):
                    SourceRoleTask.model_validate(raw)

    def test_shared_page_is_not_repeated_and_changed_or_unreadable_source_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            _, page, owner, _, _ = role_case(Path(directory))
            second = owner.model_copy(
                update={"id": "second", "box": owner.box.model_copy(update={"y0": 300, "y1": 360})}
            )
            crops, _ = source_role_sheet(page, [owner, second], Path(directory))
            self.assertEqual(1, sum(c.part == "page" for c in crops))
            self.assertEqual(2, sum(c.part == "local" for c in crops))
            rotated = page.model_copy(
                update={"observation": page.observation.model_copy(update={"rotation": 90})}
            )
            self.assertIsNone(source_role_sheet(rotated, [owner], Path(directory)))
            path = Path(directory) / page.observation.render_path
            path.write_bytes(b"changed")
            with self.assertRaises(ValueError):
                source_role_sheet(page, [owner], Path(directory))
