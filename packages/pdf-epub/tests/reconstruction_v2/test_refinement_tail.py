"""Long paragraph comparisons retain actual last-line pixels, not just opening text."""

import base64
import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from PIL import Image, ImageDraw

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement

from .refinement_evidence import join_decisions
from .test_refinement_grouping import segment


class RefinementTailTest(unittest.TestCase):
    def test_boundary_requires_actual_tail_while_body_style_keeps_head(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            raster = Image.new("RGB", (500, 720), "white")
            draw = ImageDraw.Draw(raster)
            draw.rectangle((20, 30, 180, 80), fill="red")
            draw.rectangle((20, 430, 180, 470), fill="blue")
            source = scratch / "source.png"
            raster.save(source)
            render_sha = hashlib.sha256(source.read_bytes()).hexdigest()
            pages = [
                SimpleNamespace(
                    observation=SimpleNamespace(
                        number=number,
                        width_pt=500,
                        height_pt=720,
                        render_path=source.name,
                        render_sha256=render_sha,
                    )
                )
                for number in (1, 2)
            ]
            previous = segment("previous", "A long printed paragraph ends without closure")
            previous = previous.model_copy(
                update={
                    "box": previous.box.model_copy(update={"y1": 480}),
                }
            )
            following = segment("following", "and continues after the turn.", page=2)
            state = AssemblyState(placements={"previous": (1, 0, 0), "following": (2, 0, 0)})
            (task,) = prepare_refinement(source, scratch, pages, [previous, following], state)
            parts = {(crop.node_id, crop.part): crop for crop in task.crops}
            head, tail = parts["previous", "head"], parts["previous", "tail"]
            self.assertLess(head.source_box.y1, 200)
            self.assertGreater(tail.source_box.y0, 300)
            self.assertEqual(484, tail.source_box.y1)
            with Image.open(io.BytesIO(base64.b64decode(task.image.base64))) as sheet:
                head_pixels = list(sheet.crop(head.image_box).getdata())
                tail_pixels = list(sheet.crop(tail.image_box).getdata())
            self.assertIn((255, 0, 0), head_pixels)
            self.assertNotIn((0, 0, 255), head_pixels)
            self.assertIn((0, 0, 255), tail_pixels)
            self.assertNotIn((255, 0, 0), tail_pixels)
            response = BookRefinementResponse.model_validate(
                dict(
                    schema_version="ava-book-refinement-response-1",
                    task_id=task.task_id,
                    source_sha256=task.source_sha256,
                    observation_sha256=task.observation_sha256,
                    image_sha256=task.image.sha256,
                    unresolved=[],
                    joins=join_decisions(task, True),
                    decisions=[
                        dict(
                            node_id=node.id,
                            text_sha256=node.text_sha256,
                            evidence_ids=[parts[node.id, "head"].id],
                            heading_level=None,
                            parent_id=None,
                            chapter_start=None,
                            chapter_role=None,
                            style=dict(id="observed", relative_size=1, bold=False),
                        )
                        for node in task.nodes
                    ],
                )
            )
            accept_refinement(task, response)
            wrong_join = response.joins[0].model_copy(
                update={"evidence_ids": [head.id, parts["following", "head"].id]}
            )
            wrong = response.model_copy(update={"joins": [wrong_join]})
            with self.assertRaisesRegex(ValueError, "both source crops"):
                accept_refinement(task, wrong)
