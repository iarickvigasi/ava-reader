"""Capture source paint and optional current-policy spacing in a single preparation step."""

from pathlib import Path
from typing import TYPE_CHECKING

from .observations import PageObservation
from .observe_page import observe_page
from .source_preparation import ParsedPage, SourcePreparation
from .spacing_page import qualify_page_spaces

if TYPE_CHECKING:
    from .native_colour_capture import ColourCapture


def observe_source_page(
    preparation: SourcePreparation,
    parsed: ParsedPage,
    page_number: int,
    *,
    existing_render: Path | None = None,
) -> tuple[PageObservation, "ColourCapture | None"]:
    scratch = preparation.scratch
    has_visible = "visible" in parsed.kinds
    capture = None
    if (
        preparation.source_layout_policy is not None
        and not has_visible
        and parsed.original_reader is not None
    ):
        try:
            from .native_colour_capture import colour_capture

            capture = colour_capture(
                parsed.view,
                page_number,
                parsed.view_reader.pages[page_number - 1],
                parsed.view_reader,
                original=parsed.original,
                original_reader=parsed.original_reader,
            )
        except (ImportError, AttributeError):
            capture = None  # Optional tool absence cannot break old import/routing.
    observation = observe_page(
        parsed.view,
        parsed.view_reader,
        parsed.page,
        page_number,
        scratch,
        capture_paint=preparation.source_feature_policy is not None,
        colour_capture=capture,
        existing_render=existing_render,
    )
    if preparation.source_layout_policy is not None and not has_visible:
        observation = qualify_page_spaces(parsed.view, parsed.page, parsed.view_reader, observation)
    return observation, capture
