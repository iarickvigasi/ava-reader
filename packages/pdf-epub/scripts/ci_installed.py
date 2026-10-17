"""Compare installed public inputs and require a complete, unskipped installed suite."""

import argparse
import hashlib
import json
import sys
import unittest
from pathlib import Path
from types import ModuleType


def inventory(root: Path) -> dict[str, str]:
    """Do not follow symlinks or hide unexpected package/test files."""
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("CI input symlink refused")
        if "__pycache__" in path.relative_to(root).parts:
            continue
        if path.is_file():
            name = path.relative_to(root).as_posix()
            result[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    if not result:
        raise ValueError("CI input inventory is empty")
    return result


def verify(expected: dict, package: Path, tests: Path) -> None:
    if set(expected) != {"package", "tests"}:
        raise ValueError("Unexpected CI manifest")
    if inventory(package) != expected["package"] or inventory(tests) != expected["tests"]:
        raise ValueError("Installed package or test inputs differ from the checkout")


def complete_run(loader: unittest.TestLoader, run: unittest.TestResult, discovered: int) -> bool:
    """A green subset, skip or expected failure is not the installed-suite gate."""
    return (
        discovered > 0
        and not loader.errors
        and run.testsRun == discovered
        and run.wasSuccessful()
        and not run.skipped
        and not run.expectedFailures
    )


class CompleteLoader(unittest.TestLoader):
    """Make silently omitted test modules a failure (for example, missing __init__.py)."""

    def __init__(self) -> None:
        super().__init__()
        self.loaded_files: set[Path] = set()

    def loadTestsFromModule(
        self, module: ModuleType, *, pattern: str | None = None
    ) -> unittest.TestSuite:
        if module.__file__:
            self.loaded_files.add(Path(module.__file__).resolve())
        return super().loadTestsFromModule(module, pattern=pattern)

    def discover_complete(self, tests: Path) -> unittest.TestSuite:
        suite = self.discover(str(tests), top_level_dir=str(tests.parent))
        expected = {p.resolve() for p in tests.rglob("test*.py") if p.is_file()}
        missing = expected - self.loaded_files
        if missing:
            names = sorted(str(p.relative_to(tests.resolve())) for p in missing)
            raise ValueError(f"Test discovery omitted modules: {names}")
        return suite


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="action", required=True)
    manifest = actions.add_parser("manifest")
    manifest.add_argument("--root", type=Path, required=True)
    manifest.add_argument("--out", type=Path, required=True)
    check = actions.add_parser("check")
    check.add_argument("--manifest", type=Path, required=True)
    check.add_argument("--tests", type=Path, required=True)
    check.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        raise ValueError("Refusing to overwrite CI evidence")
    if args.action == "manifest":
        result = {
            "package": inventory(args.root / "src/ava_pdf_epub"),
            "tests": inventory(args.root / "tests"),
        }
        args.out.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n")
        return

    import ava_pdf_epub

    package = Path(ava_pdf_epub.__file__).resolve().parent
    if not package.is_relative_to(Path("/worker/.venv/lib")):
        raise ValueError("Converter was not imported from the installed worker")
    expected = json.loads(args.manifest.read_text())
    verify(expected, package, args.tests)
    loader = CompleteLoader()
    suite = loader.discover_complete(args.tests)
    discovered = suite.countTestCases()
    run = unittest.TextTestRunner(verbosity=2).run(suite)
    # Recheck after execution as well; no production source is mounted into this container.
    verify(expected, package, args.tests)
    passed = complete_run(loader, run, discovered)
    result = {
        "status": "PASS_INSTALLED_PACKAGE_ONLY" if passed else "FAIL",
        "package_path": str(package),
        "package_files": len(expected["package"]),
        "test_inputs": len(expected["tests"]),
        "manifest_sha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
        "discovered": discovered,
        "tests_run": run.testsRun,
        "failures": len(run.failures),
        "errors": len(run.errors),
        "loader_errors": len(loader.errors),
        "skipped": len(run.skipped),
        "expected_failures": len(run.expectedFailures),
        "unexpected_successes": len(run.unexpectedSuccesses),
        "limits": "No provider, database, authenticated import, reader or release qualification",
    }
    args.out.write_text(json.dumps(result, sort_keys=True, indent=2) + "\n")
    if not passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
