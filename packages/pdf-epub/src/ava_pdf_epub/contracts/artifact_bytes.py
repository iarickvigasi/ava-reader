"""Verify private artifact bytes without traversal, symlinks or arbitrary public reads."""

import hashlib
import os
import stat
from pathlib import Path

from .artifacts import Artifact


def verify_artifact_bytes(root: Path, artifact: Artifact) -> None:
    """Caller supplies a trusted attempt directory. Never pass a reader-selected root.

    Validate descriptor again to reject mutation; open each component beneath a directory fd
    without following symlinks. This is local integrity verification, not runtime isolation.
    """
    artifact = Artifact.model_validate(artifact.model_dump())
    flags = os.O_RDONLY | os.O_NOFOLLOW
    directory = os.open(root, flags | os.O_DIRECTORY)
    descriptor = None
    try:
        parts = artifact.path.split("/")
        for part in parts[:-1]:
            child = os.open(part, flags | os.O_DIRECTORY, dir_fd=directory)
            os.close(directory)
            directory = child
        descriptor = os.open(parts[-1], flags | os.O_NONBLOCK, dir_fd=directory)
        details = os.fstat(descriptor)
        if not stat.S_ISREG(details.st_mode) or details.st_size != artifact.byte_length:
            raise ValueError("Artifact type or size does not match manifest")
        digest = hashlib.sha256()
        total = 0
        while chunk := os.read(descriptor, 1024 * 1024):
            total += len(chunk)
            if total > artifact.byte_length:
                raise ValueError("Artifact grew during verification")
            digest.update(chunk)
        if total != artifact.byte_length or digest.hexdigest() != artifact.sha256:
            raise ValueError("Artifact bytes do not match manifest")
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(directory)
