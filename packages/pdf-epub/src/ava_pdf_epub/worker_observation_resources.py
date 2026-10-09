"""Process usage and bounded final scratch size; neither is a container resource peak."""

import os
import resource
import stat
import sys
import time
from pathlib import Path
from typing import Any

SCAN_ENTRIES = 4096
SCAN_SECONDS = 0.02
MAX_COUNT = 9007199254740991


def usage() -> tuple[Any, Any] | None:
    try:
        return resource.getrusage(resource.RUSAGE_SELF), resource.getrusage(resource.RUSAGE_CHILDREN)
    except Exception:
        return None


def _milliseconds(value: float) -> int | None:
    result = round(value * 1000)
    return result if 0 <= result <= MAX_COUNT else None


def resources(before: tuple[Any, Any] | None, scratch: Path) -> dict[str, object]:
    after = usage()
    platform = "linux_kib" if sys.platform == "linux" else (
        "darwin_bytes" if sys.platform == "darwin" else "unknown"
    )
    own = children = peak = None
    if before is not None and after is not None:
        own = _milliseconds(after[0].ru_utime + after[0].ru_stime -
                            before[0].ru_utime - before[0].ru_stime)
        children = _milliseconds(after[1].ru_utime + after[1].ru_stime -
                                 before[1].ru_utime - before[1].ru_stime)
    if after is not None and platform != "unknown":
        measured = int(after[0].ru_maxrss) * (1024 if platform == "linux_kib" else 1)
        peak = measured if 0 <= measured <= MAX_COUNT else None
    current, scan = scratch_bytes(scratch)
    return dict(cpu_self_ms=own, cpu_finished_children_ms=children, peak_rss_bytes=peak,
                cpu_method="rusage_delta_self_and_reaped_children",
                peak_rss_method="rusage_lifetime_max_not_delta",
                peak_rss_scope="worker_process", peak_rss_platform=platform,
                scratch_current_bytes=current, scratch_scan=scan,
                scratch_bytes_method="logical_regular_file_sizes_at_command_end")


def scratch_bytes(root: Path) -> tuple[int | None, str]:
    """Sum current regular-file lengths without opening file contents or following symlinks."""
    deadline, total, entries = time.monotonic() + SCAN_SECONDS, 0, 0
    descriptors: list[int] = []
    try:
        descriptors.append(os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW))
        pending = [descriptors[0]]
        while pending:
            parent = pending.pop()
            with os.scandir(parent) as directory:
                for entry in directory:
                    entries += 1
                    if entries > SCAN_ENTRIES:
                        return None, "entry_limit"
                    if time.monotonic() >= deadline:
                        return None, "time_limit"
                    info = entry.stat(follow_symlinks=False)
                    if stat.S_ISREG(info.st_mode):
                        total += info.st_size
                        if not 0 <= total <= MAX_COUNT:
                            return None, "unavailable"
                    elif stat.S_ISDIR(info.st_mode):
                        child = os.open(entry.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                        dir_fd=parent)
                        descriptors.append(child)
                        pending.append(child)
                    else:
                        return None, "unsafe_entry"
            os.close(parent)
            descriptors.remove(parent)
        return total, "complete"
    except (OSError, ValueError):
        return None, "unavailable"
    finally:
        for descriptor in descriptors:
            os.close(descriptor)
