"""Bound and reobserve an immutable complete source for comparison or final reconstruction."""

import tempfile
from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import phase
from .native_layout_policy import NativeLayoutPolicy
from .native_structure_policy import AnyNativeStructurePolicy, validate_structure_policy
from .native_word_wrap_policy import NativeWordWrapPolicy, validate_word_wrap_policy
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
    source_structure_policy: AnyNativeStructurePolicy | None = None,
    source_normalization_policy: NativeWordWrapPolicy | None = None,
) -> PageCheckpoints:
    structure = validate_structure_policy(source_structure_policy)
    if structure is not None and source_layout_policy is None:
        raise ValueError("Native structure policy requires native layout authority")
    normalization = validate_word_wrap_policy(source_normalization_policy)
    if structure == "ava-native-structure-2" and normalization is None:
        raise ValueError("Native2 source preparation requires captured sparse normalization")
    if normalization is not None and structure is None:
        raise ValueError("Native word-wrap policy requires native structure authority")
    with phase("prepare_source"):
        return _prepare_source(
            source,
            scratch,
            source_sha256,
            profile_id,
            source_feature_policy,
            source_layout_policy,
            structure,
            normalization,
        )


def _prepare_source(
    source: Path,
    scratch: Path,
    source_sha256: str,
    profile_id: ProfileId,
    source_feature_policy: str | None,
    source_layout_policy: NativeLayoutPolicy | None,
    source_structure_policy: AnyNativeStructurePolicy | None,
    source_normalization_policy: NativeWordWrapPolicy | None,
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
        if source_structure_policy is not None:
            from .qualify_native_structure import qualify_native_structure

            qualify_native_structure(
                pages,
                scratch,
                source_structure_policy,
                source_normalization_policy=source_normalization_policy,
            )
        if source_normalization_policy is not None:
            from .qualify_native_word_wrap import qualify_native_word_wrap

            qualify_native_word_wrap(pages, scratch, source_normalization_policy)
    return pages
