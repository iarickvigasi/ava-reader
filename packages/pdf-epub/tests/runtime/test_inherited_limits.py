import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.extract_worker import main


class InheritedLimitTests(unittest.TestCase):
    def test_extractor_keeps_stricter_inherited_cpu_and_memory_limits(self):
        import resource

        with tempfile.TemporaryDirectory() as temporary:
            with (
                patch("sys.platform", "linux"),
                patch(
                    "sys.argv",
                    ["worker", "inspect", "unused.pdf", str(Path(temporary) / "out.json")],
                ),
                patch("resource.getrlimit", side_effect=[(123456, 234567), (20, 30)]),
                patch("resource.setrlimit") as limits,
                patch("ava_pdf_epub.extract.inspect_pdf", return_value={}),
            ):
                main()
                self.assertEqual(
                    limits.call_args_list[0].args, (resource.RLIMIT_AS, (123456, 123456))
                )
                self.assertEqual(limits.call_args_list[1].args, (resource.RLIMIT_CPU, (20, 20)))
