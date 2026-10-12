"""Bound and reobserve an immutable complete source for comparison or final reconstruction."""

import tempfile
from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import phase
from .page_checkpoints import PageCheckpoints
from .prepare_page import prepare_from_source
from .qualify_embedded_images import qualify_embedded_images
from .source_preparation import SourcePreparation


def prepare_source(
    source: Path,
    scratch: Path,
    source_sha256: str,
    profile_id: ProfileId = LEGACY_PROFILE,
    *,
    source_feature_policy: str | None = None,
) -> PageCheckpoints:
    with phase("prepare_source"):
        return _prepare_source(source, scratch, source_sha256, profile_id, source_feature_policy)


def _prepare_source(
    source: Path,
    scratch: Path,
    source_sha256: str,
    profile_id: ProfileId,
    source_feature_policy: str | None,
) -> PageCheckpoints:
    with SourcePreparation(
        source, scratch, profile_id, source_sha256, source_feature_policy=source_feature_policy
    ) as preparation:
        scratch.mkdir(parents=True, exist_ok=True)
        pages = PageCheckpoints(Path(tempfile.mkdtemp(prefix="observations-", dir=scratch)))
        for number in range(1, preparation.count + 1):
            pages.append(prepare_from_source(preparation, number))
        qualify_embedded_images(pages, scratch, source_feature_policy)
    return pages
