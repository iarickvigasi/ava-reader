"""The diagnostic payload ceiling follows typed captured input, not a schema claim."""

import unittest

from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.refinement_transport import refinement_payload_limit


class RefinementPayloadLimitTests(unittest.TestCase):
    def test_only_complete_current_input_selects_larger_payload(self):
        current = dict(
            schema_version="ava-reconstruct-input-10",
            source_sha256="a" * 64,
            profile_id="ava-pdf-prose-en-v2",
            responses=[],
            refinements=[],
            source_feature_policy="ava-ocr-source-features-1",
            source_layout_policy="ava-native-layout-1",
            source_structure_policy="ava-native-structure-2",
            native_structure_responses=[],
            source_normalization_policy="ava-native-word-wrap-1",
            word_wrap_responses=[],
            recognition_repair_policy="ava-recognition-geometry-repair-2",
            geometry_corrections=[],
            source_title_policy="ava-frontmatter-title-1",
            source_continuation_policy="ava-source-continuation-presentation-1",
        )
        previous = {k: v for k, v in current.items() if k != "source_continuation_policy"}
        previous["schema_version"] = "ava-reconstruct-input-9"
        self.assertEqual(64 * 1024 * 1024, refinement_payload_limit(reconstruction_input(current)))
        self.assertEqual(24 * 1024 * 1024, refinement_payload_limit(reconstruction_input(previous)))
        self.assertEqual(24 * 1024 * 1024, refinement_payload_limit(current))
        with self.assertRaises(ValueError):
            reconstruction_input({**current, "source_continuation_policy": "wrong"})
