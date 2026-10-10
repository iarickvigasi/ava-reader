"""Check the CI gate's failure policy without a worker or external service."""

import sys
import tempfile
import unittest
from pathlib import Path

from ci_installed import CompleteLoader, complete_run, inventory, verify


class InventoryTests(unittest.TestCase):
    def test_exact_files_and_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package, tests = root / "package", root / "tests"
            package.mkdir()
            tests.mkdir()
            (package / "module.py").write_text("original")
            (tests / "test_module.py").write_text("test")
            expected = {"package": inventory(package), "tests": inventory(tests)}
            verify(expected, package, tests)
            (package / "extra.py").write_text("extra")
            with self.assertRaises(ValueError):
                verify(expected, package, tests)
            (package / "extra.py").unlink()
            (package / "module.py").write_text("changed")
            with self.assertRaises(ValueError):
                verify(expected, package, tests)
            (package / "module.py").write_text("original")
            (tests / "test_module.py").unlink()
            with self.assertRaises(ValueError):
                verify(expected, package, tests)

    def test_symlinks_and_empty_inputs_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                inventory(root)
            (root / "file").write_text("content")
            (root / "link").symlink_to(root / "file")
            with self.assertRaises(ValueError):
                inventory(root)

    def test_interpreter_bytecode_is_not_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "module.py").write_text("source")
            expected = inventory(root)
            (root / "__pycache__").mkdir()
            (root / "__pycache__/module.pyc").write_bytes(b"compiled")
            self.assertEqual(inventory(root), expected)


class CompletionTests(unittest.TestCase):
    def test_missing_package_marker_cannot_silently_omit_a_subtree(self) -> None:
        original_path = sys.path[:]
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory) / "ci_public_tests"
                nested = root / "nested"
                nested.mkdir(parents=True)
                (root / "__init__.py").write_text("")
                example = (
                    "import unittest\n"
                    "class Check(unittest.TestCase):\n"
                    "    def test_example(self): pass\n"
                )
                (root / "test_top.py").write_text(example)
                (nested / "test_nested.py").write_text(example)
                with self.assertRaisesRegex(ValueError, "nested/test_nested.py"):
                    CompleteLoader().discover_complete(root)
                (nested / "__init__.py").write_text("")
                self.assertEqual(CompleteLoader().discover_complete(root).countTestCases(), 2)
        finally:
            sys.path[:] = original_path
            for name in list(sys.modules):
                if name == "ci_public_tests" or name.startswith("ci_public_tests."):
                    sys.modules.pop(name)

    def test_only_complete_pass_is_accepted(self) -> None:
        loader = unittest.TestLoader()
        result = unittest.TestResult()
        result.testsRun = 2
        self.assertTrue(complete_run(loader, result, 2))
        self.assertFalse(complete_run(loader, result, 3))
        self.assertFalse(complete_run(loader, result, 0))
        loader.errors.append("failed import")
        self.assertFalse(complete_run(loader, result, 2))

    def test_skip_expected_failure_error_failure_and_unexpected_success_refused(self) -> None:
        case = unittest.FunctionTestCase(lambda: None)
        for field in ("skipped", "expectedFailures", "errors", "failures", "unexpectedSuccesses"):
            with self.subTest(field=field):
                result = unittest.TestResult()
                result.testsRun = 1
                value = case if field == "unexpectedSuccesses" else (case, "reason")
                getattr(result, field).append(value)
                self.assertFalse(complete_run(unittest.TestLoader(), result, 1))


if __name__ == "__main__":
    unittest.main()
