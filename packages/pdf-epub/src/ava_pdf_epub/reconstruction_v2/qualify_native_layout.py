"""Complete-source policy qualification happens before any page/model announcement."""

from pathlib import Path

from ..worker_observation import observe
from .conservation import native_conservation
from .furniture import furniture_ids
from .native_layout_policy import NativeLayoutPolicy, validate_layout_policy
from .native_layout_qualification import qualified_layout
from .native_line_offsets import NativeLineOffset, mapped_native_ids, native_line_offsets
from .native_page import native_page
from .page_checkpoints import PageCheckpoints
from .prepared_native_layout import NativeLayoutPreparedPage
from .raster_regions import raster_regions
from .route_native import route_native


def qualify_native_layout(
    pages: PageCheckpoints, scratch: Path, policy: NativeLayoutPolicy | None
) -> None:
    policy = validate_layout_policy(policy)
    if policy is None:
        return
    furniture = furniture_ids((p.observation for p in pages), pages[0].profile_id)
    for index in range(len(pages)):
        page = pages[index]
        native, tasks = page.native_segments, page.tasks
        maps: list[NativeLineOffset] = native_line_offsets(
            page.observation, native, mapped_native_ids(native)
        )
        if qualified_layout(page.observation):
            maps = []
            native, tasks = route_native(
                page.observation,
                page.tables,
                raster_regions(page.observation, scratch, page.profile_id),
                page.source_sha256,
                scratch,
                page.profile_id,
                furniture=furniture,
                source_layout_policy=policy,
                source_line_maps=maps,
            )
            native_conservation(page.observation, native, [t.region_box for t in tasks])
        else:
            # Retain every old task and its receipt identity. Whole-source furniture
            # changes only the same native assembly already used by the legacy path;
            # unknown paint never authorizes a new zero-recognition route.
            native = native_page(
                page.observation,
                page.tables,
                furniture,
                [t.region_box for t in tasks],
                page.profile_id,
            )
            maps = native_line_offsets(page.observation, native, mapped_native_ids(native))
            native_conservation(page.observation, native, [t.region_box for t in tasks])
        result = NativeLayoutPreparedPage.model_validate(
            {
                **page.model_dump(),
                "schema_version": "ava-prepared-page-2",
                "source_layout_policy": policy,
                "native_segments": native,
                "tasks": tasks,
                "native_line_maps": maps,
            }
        )
        pages.qualify(index, result)
        observe("page", result)
