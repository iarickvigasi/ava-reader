"""Fresh source proof uses retained raster bytes, never a saved colour as authority."""

from pathlib import Path

from .native_colour_witness import colours, digest
from .native_layout_policy import NATIVE_LAYOUT_POLICY
from .native_layout_qualification import qualified_layout
from .native_line_offsets import NativeLineOffset, mapped_native_ids, native_line_offsets
from .native_page import native_page
from .prepare_page import prepare_from_source
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_types import AnyPreparedPage
from .raster_regions import raster_regions
from .route_native import route_native
from .source_preparation import SourcePreparation


def reobserve_colour_page(
    preparation: SourcePreparation, number: int, *, existing_render: Path
) -> AnyPreparedPage:
    if preparation.source_layout_policy != NATIVE_LAYOUT_POLICY:
        raise ValueError("Native colour reobservation requires captured layout policy")
    return prepare_from_source(preparation, number, existing_render=existing_render)


def qualify_colour_page(
    page: NativeLayoutPreparedPage, scratch: Path, furniture: set[str]
) -> NativeLayoutPreparedPage:
    mappings: list[NativeLineOffset] = []
    if qualified_layout(page.observation):
        native, tasks = route_native(
            page.observation,
            page.tables,
            raster_regions(page.observation, scratch, page.profile_id),
            page.source_sha256,
            scratch,
            page.profile_id,
            furniture=furniture,
            source_layout_policy=page.source_layout_policy,
            source_line_maps=mappings,
        )
    else:
        tasks = page.tasks
        native = native_page(
            page.observation, page.tables, furniture, [t.region_box for t in tasks], page.profile_id
        )
        mappings = native_line_offsets(page.observation, native, mapped_native_ids(native))
    witness = page.native_colour_witness
    if witness is not None:
        # This API is for fresh source-recomputed pages only. It cannot validate
        # saved colours; final qualification separately reobserves from source.
        witness = witness.model_copy(
            update={"segment_overlay_sha256": digest([colours(s) for s in native])}
        )
    return NativeLayoutPreparedPage.model_validate(
        {
            **page.model_dump(),
            "native_segments": [s.model_dump() for s in native],
            "tasks": [t.model_dump() for t in tasks],
            "native_line_maps": [m.model_dump() for m in mappings],
            **({"native_colour_witness": witness.model_dump()} if witness else {}),
        }
    )
