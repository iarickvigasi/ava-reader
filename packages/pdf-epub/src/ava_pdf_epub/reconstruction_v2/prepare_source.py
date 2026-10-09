"""Bound and reobserve an immutable complete source for comparison or final reconstruction."""

import gc
import hashlib
import tempfile
from pathlib import Path

from pypdf import PdfReader

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import phase
from .page_checkpoints import PageCheckpoints
from .prepare_page import prepare_page


def prepare_source(
    source: Path, scratch: Path, source_sha256: str, profile_id: ProfileId = LEGACY_PROFILE
) -> PageCheckpoints:
    with phase("prepare_source"):
        return _prepare_source(source, scratch, source_sha256, profile_id)


def _prepare_source(
    source: Path, scratch: Path, source_sha256: str, profile_id: ProfileId
) -> PageCheckpoints:
    if (
        source.stat().st_size > 52428800
        or hashlib.sha256(source.read_bytes()).hexdigest() != source_sha256
    ):
        raise ValueError("Reconstruction source identity differs")
    count = len(PdfReader(source).pages)
    if not 1 <= count <= 500:
        raise ValueError("Source page bound exceeded")
    scratch.mkdir(parents=True, exist_ok=True)
    pages = PageCheckpoints(Path(tempfile.mkdtemp(prefix="observations-", dir=scratch)))
    for number in range(1, count + 1):
        pages.append(prepare_page(source, scratch, number, profile_id))
        # PDF parser object cycles may own decoded streams larger than GC's object count.
        gc.collect()
    return pages
