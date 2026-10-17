"""Legacy import does not initialize the optional native colour SDK."""

import subprocess
import sys
import unittest
from pathlib import Path

import ava_pdf_epub


class SpacingOptionalImportTests(unittest.TestCase):
    def test_legacy_prepare_import_survives_missing_optional_colour_extension(self):
        script = """
import importlib.abc
import sys
sys.path.insert(0, sys.argv[1])
class NoColour(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "PIL._imagingcms":
            raise ImportError("optional CMS deliberately unavailable")
sys.meta_path.insert(0, NoColour())
import ava_pdf_epub.reconstruction_v2.prepare_page
print("PASS_LEGACY_PREPARE_IMPORT_WITHOUT_OPTIONAL_CMS")
"""
        root = str(Path(ava_pdf_epub.__file__).resolve().parent.parent)
        result = subprocess.run(
            [sys.executable, "-I", "-B", "-c", script, root],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PASS_LEGACY_PREPARE_IMPORT_WITHOUT_OPTIONAL_CMS", result.stdout)
