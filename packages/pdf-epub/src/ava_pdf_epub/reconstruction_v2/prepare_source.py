"""Bound and reobserve an immutable complete source for comparison or final reconstruction."""

import tempfile
from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import phase
from .page_checkpoints import PageCheckpoints
from .prepare_page import prepare_from_source
from .source_preparation import SourcePreparation


def prepare_source(
    source: Path, scratch: Path, source_sha256: str, profile_id: ProfileId = LEGACY_PROFILE
) -> PageCheckpoints:
    with phase("prepare_source"):
        return _prepare_source(source, scratch, source_sha256, profile_id)


def _prepare_source(
    source: Path, scratch: Path, source_sha256: str, profile_id: ProfileId
) -> PageCheckpoints:
    with SourcePreparation(source, scratch, profile_id, source_sha256) as preparation:
        scratch.mkdir(parents=True, exist_ok=True)
        pages = PageCheckpoints(Path(tempfile.mkdtemp(prefix="observations-", dir=scratch)))
        for number in range(1, preparation.count + 1):
            pages.append(prepare_from_source(preparation, number))
    return pages
