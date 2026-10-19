"""Bounded reads rooted in a trusted private directory; never follow symlinks."""

import hashlib
import os
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from pydantic import TypeAdapter

from .artifacts import FORMATS, Artifact
from .common import RelativePath


@contextmanager
def private_file(root: Path, relative: str) -> Iterator[tuple[int, int]]:
    TypeAdapter(RelativePath).validate_python(relative, strict=True)
    flags = os.O_RDONLY | os.O_NOFOLLOW
    directory = os.open(root, flags | os.O_DIRECTORY)
    descriptor = None
    try:
        parts = relative.split("/")
        for part in parts[:-1]:
            child = os.open(part, flags | os.O_DIRECTORY, dir_fd=directory)
            os.close(directory)
            directory = child
        descriptor = os.open(parts[-1], flags | os.O_NONBLOCK, dir_fd=directory)
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("Artifact must be a regular file")
        yield descriptor, info.st_size
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(directory)


def snapshot(root: Path, relative: str, limit: int) -> bytes:
    with private_file(root, relative) as (descriptor, size):
        if not 0 < size <= limit:
            raise ValueError("Artifact byte bound exceeded")
        chunks = []
        total = 0
        while chunk := os.read(descriptor, min(1024 * 1024, limit + 1 - total)):
            total += len(chunk)
            if total > limit:
                raise ValueError("Artifact byte bound exceeded")
            chunks.append(chunk)
        if total != size:
            raise ValueError("Artifact changed during read")
        return b"".join(chunks)


def describe(
    root: Path,
    relative: str,
    role: str,
    ident: str,
    media_type: str | None = None,
    limit: int = 209715200,
) -> Artifact:
    with private_file(root, relative) as (descriptor, size):
        if not 0 < size <= limit:
            raise ValueError("Artifact byte bound exceeded")
        digest = hashlib.sha256()
        total = 0
        while chunk := os.read(descriptor, 1024 * 1024):
            total += len(chunk)
            if total > size:
                raise ValueError("Artifact changed during read")
            digest.update(chunk)
        if total != size:
            raise ValueError("Artifact changed during read")
    format_, default_media = FORMATS[role]
    return Artifact.model_validate(
        dict(
            id=ident,
            role=role,
            format=format_,
            media_type=media_type or default_media,
            path=relative,
            byte_length=size,
            sha256=digest.hexdigest(),
        )
    )
