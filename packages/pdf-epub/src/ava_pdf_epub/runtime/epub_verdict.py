"""Separate content rejection from unavailable validation infrastructure."""

from typing import Any


class InvalidEpub(ValueError):
    pass


class ValidatorUnavailable(RuntimeError):
    pass


def epub_verdict(check: dict[str, Any]) -> tuple[list[str], list[str]]:
    report = check.get("report")
    if not isinstance(report, dict) or not isinstance(report.get("messages"), list):
        raise ValidatorUnavailable("EPUBCheck produced no structured report")
    messages = report["messages"]
    if any(not isinstance(m, dict) for m in messages):
        raise ValidatorUnavailable("EPUBCheck report is malformed")
    errors = [
        str(m.get("ID", "UNKNOWN")) for m in messages if m.get("severity") in {"ERROR", "FATAL"}
    ]
    warnings = [str(m.get("ID", "UNKNOWN")) for m in messages if m.get("severity") == "WARNING"]
    if errors:
        raise InvalidEpub("EPUBCheck rejected content")
    checker = report.get("checker", {})
    if (
        check.get("status") != "pass"
        or check.get("returncode") != 0
        or checker.get("checkerVersion") != "5.4.0"
        or checker.get("nError") != 0
        or checker.get("nFatal") != 0
    ):
        raise ValidatorUnavailable("EPUBCheck did not establish validity")
    return errors, warnings
