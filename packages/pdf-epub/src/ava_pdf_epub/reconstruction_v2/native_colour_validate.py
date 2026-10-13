"""Saved colour is valid only when the immutable source reproduces its complete overlay."""

from collections.abc import Sequence
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import cast

from .native_colour_reobserve import reobserve_colour_page
from .native_layout_policy import NATIVE_LAYOUT_POLICY, NativeLayoutPolicy
from .page_checkpoints import PageCheckpoints
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_types import AnyPreparedPage
from .qualify_embedded_images import qualify_embedded_images
from .qualify_native_layout import qualify_native_layout
from .source_feature_contract import FEATURE_POLICY
from .source_preparation import SourcePreparation


def verify_source_colours(
    source: Path, scratch: Path, pages: Sequence[AnyPreparedPage], furniture: set[str]
) -> None:
    policy = cast(NativeLayoutPolicy, NATIVE_LAYOUT_POLICY)
    with (
        SourcePreparation(
            source,
            scratch,
            pages[0].profile_id,
            pages[0].source_sha256,
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=policy,
        ) as preparation,
        TemporaryDirectory(prefix="colour-recompute-", dir=scratch) as directory,
    ):
        fresh_pages = PageCheckpoints(Path(directory), policy)
        for page in pages:
            if not isinstance(page, (NativeLayoutPreparedPage, NativeStructurePreparedPage)):
                raise ValueError("Native colour requires the selected private page version")
            rendered = scratch / page.observation.render_path
            if rendered.resolve().parent != (scratch / "renders").resolve():
                raise ValueError("Native colour render must belong to source scratch")
            fresh = reobserve_colour_page(
                preparation, page.observation.number, existing_render=rendered
            )
            if not isinstance(fresh, NativeLayoutPreparedPage):
                raise ValueError("Native colour reobservation lost source policy")
            fresh_pages.append(fresh)
        # Reproduce existing whole-source image and native qualification too. Saved
        # qualification flags cannot stand in for ordinary source paint when the
        # optional tool or witness is missing.
        qualify_embedded_images(fresh_pages, scratch, FEATURE_POLICY)
        qualify_native_layout(fresh_pages, scratch, policy)
        if isinstance(pages[0], NativeStructurePreparedPage):
            from .qualify_native_structure import qualify_native_structure

            qualify_native_structure(fresh_pages, scratch, pages[0].source_structure_policy)
        for page, fresh in zip(pages, fresh_pages, strict=True):
            if not isinstance(
                page, (NativeLayoutPreparedPage, NativeStructurePreparedPage)
            ) or not isinstance(fresh, (NativeLayoutPreparedPage, NativeStructurePreparedPage)):
                raise ValueError("Native colour recomputation lost source policy")
            if fresh != page:
                raise ValueError("Native colour source/overlay does not reproduce the saved page")
        preparation.verify_inputs()
