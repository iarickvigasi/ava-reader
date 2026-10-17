"""A wider optional peer must not turn a usable heading/body comparison into an error."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks

from .source_feature_fixtures import case


class FeaturePeers(unittest.TestCase):
    def test_incompatible_optional_peer_is_omitted_without_clipping_or_changing_it(self):
        with tempfile.TemporaryDirectory() as d:
            source, page, segments, _, _ = case(Path(d), include_quote=False)
            heading = segments[0].model_copy(
                update={"box": segments[0].box.model_copy(update={"x0": 80.0, "x1": 180.0})}
            )
            body = next(s for s in segments if s.id == "body").model_copy(
                update={"box": segments[1].box.model_copy(update={"x0": 50.0, "x1": 250.0})}
            )
            peer = heading.model_copy(
                update={
                    "id": "wide-peer",
                    "box": heading.box.model_copy(
                        update={"x0": 40.0, "x1": 260.0, "y0": 360.0, "y1": 380.0}
                    ),
                }
            )
            tasks = source_feature_tasks(
                source, Path(d), [page], [heading, body, peer], AssemblyState(), 0
            )
            request = next(q for t in tasks for q in t.source_features if q.node_id == heading.id)
            self.assertEqual([body.id], request.reference_ids)
            self.assertEqual((40.0, 260.0), (peer.box.x0, peer.box.x1))
            self.assertTrue(
                all(
                    c.source_box.x0
                    <= next(s for s in [heading, body, peer] if s.id == c.node_id).box.x0
                    for t in tasks
                    for c in t.crops
                )
            )
