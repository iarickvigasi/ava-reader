"""Native ancestry review has new task authority without rewriting historical prompts."""

import hashlib
import unittest

from ava_pdf_epub.reconstruction_v2.refinement_prompt import (
    LEGACY_REFINEMENT_PROMPT,
    MIXED_HIERARCHY_PROMPT,
    MIXED_HIERARCHY_PROMPT_VERSION,
    REFINEMENT_PROMPT,
    REFINEMENT_PROMPT_VERSION,
)


class MixedHeadingPrompt(unittest.TestCase):
    def test_historical_prompt_bytes_and_versions_remain_exact(self):
        self.assertEqual("ava-book-refinement-5", REFINEMENT_PROMPT_VERSION)
        for prompt, expected in [
            (
                LEGACY_REFINEMENT_PROMPT,
                "6076e133932c5dfc0e3599453a906bd01bf71cde48fc69dfcb02fa16d7948b40",
            ),
            (REFINEMENT_PROMPT, "6d407c429c9c8fa803e8216d01369b4df1072428c010a4aecab4eed21aa827ec"),
        ]:
            self.assertEqual(expected, hashlib.sha256(prompt.encode()).hexdigest())

    def test_new_prompt_requires_source_ancestry_and_fixed_native_role_style(self):
        self.assertEqual("ava-book-refinement-6", MIXED_HIERARCHY_PROMPT_VERSION)
        self.assertTrue(MIXED_HIERARCHY_PROMPT.startswith(REFINEMENT_PROMPT))
        for instruction in [
            "candidate_original_kind:heading",
            "role_kind:heading with style:null",
            "ranked_source",
            "unresolved",
            "not proof",
        ]:
            self.assertIn(instruction, MIXED_HIERARCHY_PROMPT)
