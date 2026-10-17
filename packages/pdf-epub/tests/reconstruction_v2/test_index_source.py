"""Exercise actual PDF observation and opt-in routing; no recognition is dispatched."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_from_source
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation

from .index_pdf_fixture import index_pdf


class IndexSourceTests(unittest.TestCase):
    def test_only_explicit_source_index_pages_gain_current_review_route(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            source = index_pdf(root / "source.pdf")
            for policy in [None, NATIVE_LAYOUT_POLICY]:
                scratch = root / ("current" if policy else "historical")
                with SourcePreparation(
                    source,
                    scratch,
                    BILINGUAL_PROFILE,
                    source_feature_policy=FEATURE_POLICY,
                    source_layout_policy=policy,
                ) as preparation:
                    for number in range(1, 7):
                        page = prepare_from_source(preparation, number)
                        expected = policy is not None and number in {1, 2}
                        self.assertEqual(expected, "native_index_layout" in page.observation.risks)
                        if expected:
                            self.assertEqual([], page.native_segments)
                            self.assertEqual([], page.native_line_maps)
                            self.assertEqual(1, len(page.tasks))
                            self.assertEqual("ava-prose-region-17", page.tasks[0].prompt_version)
                            self.assertEqual("pdf_structure_repair", page.tasks[0].purpose)
                            self.assertEqual(
                                {"reliable": False, "lines": []},
                                json.loads(page.tasks[0].native_evidence),
                            )
                        else:
                            self.assertFalse(
                                any(t.prompt_version == "ava-prose-region-17" for t in page.tasks)
                            )
