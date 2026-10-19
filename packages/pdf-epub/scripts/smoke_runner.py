"""Run the installed CLI with a bounded, credential-free subprocess environment."""

import json
import os
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path


def command_runner(out: Path) -> Callable[[str, list[str], int], dict]:
    executable = Path(sys.executable).with_name("ava-pdf-epub")
    # Never inherit provider keys, proxy settings or PYTHONPATH into CLI subprocesses.
    env = {k: os.environ[k] for k in ("PATH", "SYSTEMROOT", "TMPDIR") if k in os.environ}
    env.update({"PYTHONNOUSERSITE": "1", "PYTHONDONTWRITEBYTECODE": "1"})
    records: list[dict[str, object]] = []

    def command(name: str, arguments: list[str], expected_exit: int) -> dict:
        invocation = [str(executable), *arguments]
        result = subprocess.run(invocation, capture_output=True, text=True, env=env, timeout=180)
        (out / f"{name}.stdout.json").write_text(result.stdout)
        (out / f"{name}.stderr.txt").write_text(result.stderr)
        records.append({"name": name, "argv": invocation, "exit": result.returncode})
        (out / "commands.json").write_text(json.dumps(records, indent=2) + "\n")
        if result.returncode != expected_exit:
            raise AssertionError(f"{name}: expected exit {expected_exit}, got {result.returncode}")
        return json.loads(result.stdout)

    return command
