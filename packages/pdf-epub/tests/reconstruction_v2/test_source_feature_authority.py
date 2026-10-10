"""Historical/native authority stays outside finite OCR source-role/style decisions."""

import tempfile
import unittest
from pathlib import Path

from .source_feature_answers import remake
from .source_feature_fixtures import case


class FeatureAuthority(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        *_, tasks = case(Path(self.temp.name))
        self.task = next(t for t in tasks if any(q.node_id == "quoted" for q in t.source_features))

    def test_historical_task_cannot_acquire_new_ocr_role_authority_or_native_override(self):
        with self.assertRaises(ValueError):
            remake(self.task, schema_version="ava-book-refinement-task-3")
        raw = self.task.model_dump(mode="json")
        target = next(n for n in raw["nodes"] if n["id"] == raw["source_features"][0]["node_id"])
        target["observation_method"] = "native"
        with self.assertRaises(ValueError):
            remake(self.task, nodes=raw["nodes"])
