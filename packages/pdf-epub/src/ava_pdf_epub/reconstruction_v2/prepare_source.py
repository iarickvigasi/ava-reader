"""Bound and reobserve an immutable complete source for comparison or final reconstruction."""

import tempfile
from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import phase
from .native_layout_policy import NativeLayoutPolicy
from .page_checkpoints import PageCheckpoints
from .prepare_page import prepare_from_source
from .qualify_embedded_images import qualify_embedded_images
from .qualify_native_layout import qualify_native_layout
from .source_preparation import SourcePreparation


def prepare_source(
    source: Path,
    scratch: Path,
    source_sha256: str,
    profile_id: ProfileId = LEGACY_PROFILE,
    *,
    source_feature_policy: str | None = None,
    source_layout_policy: NativeLayoutPolicy | None = None,
) -> PageCheckpoints:
    with phase("prepare_source"):
        return _prepare_source(
            source, scratch, source_sha256, profile_id, source_feature_policy, source_layout_policy
        )


def _prepare_source(
    source: Path,
    scratch: Path,
    source_sha256: str,
    profile_id: ProfileId,
    source_feature_policy: str | None,
    source_layout_policy: NativeLayoutPolicy | None,
) -> PageCheckpoints:
    with SourcePreparation(
        source,
        scratch,
        profile_id,
        source_sha256,
        source_feature_policy=source_feature_policy,
        source_layout_policy=source_layout_policy,
    ) as preparation:
        scratch.mkdir(parents=True, exist_ok=True)
        pages = PageCheckpoints(
            Path(tempfile.mkdtemp(prefix="observations-", dir=scratch)), source_layout_policy
        )
        for number in range(1, preparation.count + 1):
            pages.append(prepare_from_source(preparation, number))
        qualify_embedded_images(pages, scratch, source_feature_policy)
        qualify_native_layout(pages, scratch, source_layout_policy)
    return pages
